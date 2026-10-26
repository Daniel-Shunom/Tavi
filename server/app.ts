import Fastify from 'fastify';
import websocket from '@fastify/websocket';
import { commandSchema, defaults, type Config, type State } from '../shared/protocol.js';
import type { CharacterCatalog } from '../shared/capabilities.js';
import type { WebSocket } from 'ws';
import { catalog as characterCatalog } from '../src/renderer/characters/registry.js';
import { decodeFrame } from './decode.js';
import attachmentCatalog from '../assets/catalog.json' with { type: 'json' };
import { itemCatalogFrom } from '../shared/wardrobe.js';
import { TwitchIntegration, type TwitchOptions } from './twitch/integration.js';
import { Companion } from './companion.js';
import { AiManager, selectionSchema, type Selection } from './ai/manager.js';

export interface AppOptions {
  ai?: AiManager;
  catalog?: CharacterCatalog;
  /** Persists the non-secret provider/model selection. */
  saveAi?: (selection: ReturnType<AiManager['selection']>) => Promise<void>;
  now?: () => number;
}
const localOrigins = [
  'http://127.0.0.1:5173',
  'http://localhost:5173',
  'http://127.0.0.1:4318',
  'http://localhost:4318',
];
/**
 * `extraOrigins` lets a service listening on a non-default port (TAVI_PORT) trust its own
 * studio origin; the default 4318/5173 origins are always trusted.
 */
export async function createApp(
  config?: Config,
  save?: (config: Config) => Promise<void>,
  twitchOptions: TwitchOptions = {},
  extraOrigins: readonly string[] = [],
  options: AppOptions = {},
) {
  const trustedOrigins = new Set([...localOrigins, ...extraOrigins]);
  const app = Fastify({ logger: false, bodyLimit: 16384 });
  await app.register(websocket, { options: { maxPayload: 16384 } });
  const ai = options.ai ?? new AiManager();
  const companion = new Companion({
    config: config ?? defaults,
    catalog: options.catalog ?? characterCatalog,
    items: itemCatalogFrom(attachmentCatalog),
    ai,
    save,
    // Body-state triggers (quiet time, chat-burst endings) are evaluated every second.
    tickMs: options.now ? undefined : 1000,
    ...(options.now ? { now: options.now } : {}),
  });
  const clients = new Set<WebSocket>();
  let mutations = Promise.resolve();
  const message = (state: State) =>
    JSON.stringify({ type: 'state', state, now: companion.clock() });
  companion.subscribe((state) => {
    const payload = message(state);
    for (const client of clients) if (client.readyState === 1) client.send(payload);
  });
  const twitch = new TwitchIntegration({
    ...twitchOptions,
    onModeration: (event) => {
      companion.moderate(event);
      twitchOptions.onModeration?.(event);
    },
    onMessage: (chat) => {
      void companion.chat(chat);
      twitchOptions.onMessage?.(chat);
    },
  });
  function isTrusted(origin: string | undefined) {
    return !!origin && trustedOrigins.has(origin);
  }
  function studioOnly(request: { headers: Record<string, string | string[] | undefined> }) {
    const origin = request.headers['origin'];
    return (
      isTrusted(typeof origin === 'string' ? origin : undefined) &&
      request.headers['x-tavi-request'] === 'studio'
    );
  }
  app.get('/api/twitch', (_, reply) => {
    reply.header('Cache-Control', 'no-store');
    return Promise.resolve(twitch.snapshot());
  });
  app.post('/api/twitch/:action', async (request, reply) => {
    reply.header('Cache-Control', 'no-store');
    if (!studioOnly(request))
      return reply.code(403).send({ error: 'Open this action from Tavi Studio.' });
    const action = (request.params as { action: string }).action;
    if (action === 'connect') return twitch.connect();
    if (action === 'disconnect') return twitch.disconnect();
    return reply.code(404).send({ error: 'Unknown Twitch action.' });
  });
  // AI provider status and selection. Keys are configured on the service only and never returned.
  app.get('/api/ai', (_, reply) => {
    reply.header('Cache-Control', 'no-store');
    return Promise.resolve(ai.status());
  });
  app.post('/api/ai', async (request, reply) => {
    reply.header('Cache-Control', 'no-store');
    if (!studioOnly(request))
      return reply.code(403).send({ error: 'Open this action from Tavi Studio.' });
    const parsed = selectionSchema.safeParse(request.body);
    if (!parsed.success)
      return reply.code(400).send({ error: 'Choose a known provider and a valid model name.' });
    const selection: Selection = parsed.data;
    const status = ai.select(selection);
    await options.saveAi?.(ai.selection());
    return status;
  });
  app.addHook('onClose', () => {
    twitch.close();
    companion.close();
    return Promise.resolve();
  });
  app.get('/api/health', () =>
    Promise.resolve({
      name: 'Tavi',
      status: 'ok',
      mode: 'proof-of-concept',
      microphone: false,
      ai: ai.active.kind === 'ai',
      twitch: twitch.snapshot().phase === 'connected',
    }),
  );
  app.get('/api/state', () => Promise.resolve(companion.state));
  app.get('/ws', { websocket: true }, (socket, request) => {
    const origin = request.headers.origin;
    if (origin && !isTrusted(origin)) {
      socket.close(1008, 'Untrusted origin');
      return;
    }
    clients.add(socket);
    socket.send(message(companion.state));
    socket.on('close', () => clients.delete(socket));
    socket.on('message', (raw) => {
      mutations = mutations.then(async () => {
        try {
          const command = commandSchema.parse(JSON.parse(decodeFrame(raw)));
          // Conversation decisions may take seconds; do not block other commands on them.
          if (command.type === 'say' || command.type === 'simulate')
            void companion.handle(command).catch(() => undefined);
          else await companion.handle(command);
        } catch {
          if (socket.readyState === 1)
            socket.send(
              JSON.stringify({
                type: 'error',
                message: 'Could not apply change. Check the value or local storage and try again.',
              }),
            );
        }
      });
    });
  });
  app.addHook('preClose', (done) => {
    for (const socket of clients) socket.close(1001, 'Server shutting down');
    done();
  });
  return app;
}
