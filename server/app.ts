import Fastify from 'fastify';
import websocket from '@fastify/websocket';
import {
  commandSchema,
  defaults,
  type Command,
  type Config,
  type State,
} from '../shared/protocol.js';
import type { CharacterCatalog } from '../shared/capabilities.js';
import type { WebSocket } from 'ws';
import { catalog as characterCatalog } from '../src/renderer/characters/registry.js';
import { decodeFrame } from './decode.js';
import attachmentCatalog from '../assets/catalog.json' with { type: 'json' };
import { itemCatalogFrom } from '../shared/wardrobe.js';
import { TwitchIntegration, type TwitchOptions } from './twitch/integration.js';
import { Companion } from './companion.js';
import { AiManager, selectionSchema, type Selection } from './ai/manager.js';
import { z } from 'zod';
import { obsConnectSchema } from '../shared/obs.js';
import { ObsWebcam } from './obs/webcam.js';

export interface AppOptions {
  ai?: AiManager;
  catalog?: CharacterCatalog;
  /** Persists the non-secret provider/model selection. */
  saveAi?: (selection: ReturnType<AiManager['selection']>) => Promise<void>;
  now?: () => number;
  isActive?: () => boolean;
}
export type AppRuntime = {
  companion: Companion;
  twitch: TwitchIntegration;
  command: (command: Command) => Promise<void>;
};
const runtimes = new WeakMap<object, AppRuntime>();
export function runtimeOf(app: object): AppRuntime {
  const runtime = runtimes.get(app);
  if (!runtime) throw new Error('Unknown companion runtime.');
  return runtime;
}
const localOrigins = [
  'http://127.0.0.1:5173',
  'http://localhost:5173',
  'http://127.0.0.1:4318',
  'http://localhost:4318',
];
/**
 * `extraOrigins` lets a service listening on a non-default port (TAVI_PORT) trust its own
 * studio origin; a getter supports a port assigned at bind time. Default 4318/5173 origins
 * are always trusted.
 */
export async function createApp(
  config?: Config,
  save?: (config: Config) => Promise<void>,
  twitchOptions: TwitchOptions = {},
  extraOrigins: readonly string[] | (() => readonly string[]) = [],
  options: AppOptions = {},
) {
  const trustedOrigins = new Set(localOrigins);
  const app = Fastify({ logger: false, bodyLimit: 16384 });
  await app.register(websocket, { options: { maxPayload: 16384 } });
  const ai = options.ai ?? new AiManager();
  const initial = config ?? defaults;
  const companion = new Companion({
    config:
      initial.scene.webcamSource !== 'manual'
        ? {
            ...initial,
            scene: {
              ...initial.scene,
              webcam: { ...initial.scene.webcam, enabled: false },
              webcamSource: 'obs',
            },
          }
        : initial,
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
  const active = () => options.isActive?.() ?? true;
  const command = (input: Command) => {
    const change = mutations.then(async () => {
      if (!active()) throw new Error('This preview has ended.');
      if (input.type === 'say' || input.type === 'simulate')
        void companion.handle(input).catch(() => undefined);
      else await companion.handle(input);
    });
    mutations = change.catch(() => undefined);
    return change;
  };
  const message = (state: State) =>
    JSON.stringify({ type: 'state', state, now: companion.clock() });
  companion.subscribe((state) => {
    if (!active()) return;
    const payload = message(state);
    for (const client of clients) if (client.readyState === 1) client.send(payload);
  });
  const twitch = new TwitchIntegration({
    ...twitchOptions,
    onModeration: (event) => {
      if (!active()) return;
      companion.moderate(event);
      twitchOptions.onModeration?.(event);
    },
    onMessage: (chat) => {
      if (!active()) return;
      void companion.chat(chat);
      twitchOptions.onMessage?.(chat);
    },
    onStreamEvent: (event) => {
      if (!active()) return;
      companion.streamEvent(event);
      twitchOptions.onStreamEvent?.(event);
    },
  });
  function isTrusted(origin: string | undefined) {
    return (
      !!origin &&
      (trustedOrigins.has(origin) ||
        (typeof extraOrigins === 'function' ? extraOrigins() : extraOrigins).includes(origin))
    );
  }
  function studioOnly(request: { headers: Record<string, string | string[] | undefined> }) {
    const origin = request.headers['origin'];
    return (
      isTrusted(typeof origin === 'string' ? origin : undefined) &&
      request.headers['x-tavi-request'] === 'studio'
    );
  }
  const obs = new ObsWebcam(async (webcam) => {
    const change = mutations.then(async () => {
      const scene = companion.state.config.scene;
      const next = webcam ?? { ...scene.webcam, enabled: false };
      if (scene.webcamSource === 'obs' && JSON.stringify(scene.webcam) === JSON.stringify(next))
        return;
      await companion.handle({
        type: 'configure',
        patch: { scene: { ...scene, webcam: next, webcamSource: 'obs' } },
      });
    });
    mutations = change.catch(() => undefined);
    await change;
  });
  app.get('/api/obs', (_, reply) => {
    reply.header('Cache-Control', 'no-store');
    return Promise.resolve(obs.status());
  });
  app.post('/api/obs/:action', async (request, reply) => {
    reply.header('Cache-Control', 'no-store');
    if (!studioOnly(request))
      return reply.code(403).send({ error: 'Open this action from Tavi Studio.' });
    const action = (request.params as { action: string }).action;
    if (action === 'connect') {
      const parsed = obsConnectSchema.safeParse(request.body);
      if (!parsed.success)
        return reply.code(400).send({ error: 'Enter a valid OBS port and password.' });
      return obs.connect(parsed.data.port, parsed.data.password);
    }
    if (action === 'disconnect') return obs.disconnect();
    if (action === 'select') {
      const parsed = z
        .object({ source: z.string().max(2048).nullable() })
        .strict()
        .safeParse(request.body);
      if (!parsed.success) return reply.code(400).send({ error: 'Choose a valid webcam source.' });
      try {
        return await obs.select(parsed.data.source);
      } catch {
        return reply
          .code(400)
          .send({ error: 'Connect OBS and choose a source from its active scene.' });
      }
    }
    return reply.code(404).send({ error: 'Unknown OBS action.' });
  });
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
    obs.close();
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
      void (async () => {
        try {
          await command(commandSchema.parse(JSON.parse(decodeFrame(raw))));
        } catch {
          if (socket.readyState === 1)
            socket.send(
              JSON.stringify({
                type: 'error',
                message: 'Could not apply change. Check the value or local storage and try again.',
              }),
            );
        }
      })();
    });
  });
  app.addHook('preClose', (done) => {
    for (const socket of clients) socket.close(1001, 'Server shutting down');
    done();
  });
  runtimes.set(app, { companion, twitch, command });
  return app;
}
