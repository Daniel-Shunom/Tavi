import Fastify from 'fastify';
import websocket from '@fastify/websocket';
import {
  commandSchema,
  initialState,
  reduce,
  type Config,
  type State,
} from '../shared/protocol.js';
import type { WebSocket } from 'ws';
import { decodeFrame } from './decode.js';
import { TwitchIntegration, type TwitchOptions } from './twitch/integration.js';
import { chatReaction } from './twitch/reactions.js';
const localOrigins = [
  'http://127.0.0.1:5173',
  'http://localhost:5173',
  'http://127.0.0.1:4318',
  'http://localhost:4318',
];
/**
 * `extraOrigins` lets a packaged service listening on a non-default port (TAVI_PORT) trust
 * its own studio origin; the default 4318/5173 origins are always trusted.
 */
export async function createApp(
  config?: Config,
  save?: (config: Config) => Promise<void>,
  twitchOptions: TwitchOptions = {},
  extraOrigins: readonly string[] = [],
) {
  const trustedOrigins = new Set([...localOrigins, ...extraOrigins]);
  const app = Fastify({ logger: false, bodyLimit: 16384 });
  await app.register(websocket, { options: { maxPayload: 16384 } });
  let state: State = initialState(config);
  const clients = new Set<WebSocket>();
  let mutations = Promise.resolve();
  let lastChatReaction = -Infinity;
  function broadcast() {
    for (const client of clients)
      if (client.readyState === 1) client.send(JSON.stringify({ type: 'state', state }));
  }
  const twitch = new TwitchIntegration({
    ...twitchOptions,
    onModeration: () => {
      if (state.action.source === 'twitch') {
        state = {
          ...state,
          action: { ...state.action, note: 'A chat message was removed by moderation.' },
        };
        broadcast();
      }
      twitchOptions.onModeration?.();
    },
    onMessage: (message) => {
      const next = chatReaction(state, message, Date.now(), lastChatReaction);
      if (next !== state) {
        state = next;
        lastChatReaction = Date.now();
        broadcast();
      }
      twitchOptions.onMessage?.(message);
    },
  });
  function isTrusted(origin: string | undefined) {
    return !!origin && trustedOrigins.has(origin);
  }
  app.get('/api/twitch', (_, reply) => {
    reply.header('Cache-Control', 'no-store');
    return Promise.resolve(twitch.snapshot());
  });
  app.post('/api/twitch/:action', async (request, reply) => {
    reply.header('Cache-Control', 'no-store');
    if (!isTrusted(request.headers.origin) || request.headers['x-tavi-request'] !== 'studio')
      return reply.code(403).send({ error: 'Open this action from Tavi Studio.' });
    const action = (request.params as { action: string }).action;
    if (action === 'connect') return twitch.connect();
    if (action === 'disconnect') return twitch.disconnect();
    return reply.code(404).send({ error: 'Unknown Twitch action.' });
  });
  app.addHook('onClose', () => {
    twitch.close();
    return Promise.resolve();
  });
  app.get('/api/health', () =>
    Promise.resolve({
      name: 'Tavi',
      status: 'ok',
      mode: 'proof-of-concept',
      microphone: false,
      twitch: twitch.snapshot().phase === 'connected',
    }),
  );
  app.get('/api/state', () => Promise.resolve(state));
  app.get('/ws', { websocket: true }, (socket, request) => {
    const origin = request.headers.origin;
    if (origin && !trustedOrigins.has(origin)) {
      socket.close(1008, 'Untrusted origin');
      return;
    }
    clients.add(socket);
    socket.send(JSON.stringify({ type: 'state', state }));
    socket.on('close', () => clients.delete(socket));
    socket.on('message', (raw) => {
      mutations = mutations.then(async () => {
        try {
          const command = commandSchema.parse(JSON.parse(decodeFrame(raw)));
          if (command.type === 'configure' && save) await save(reduce(state, command).config);
          state = reduce(state, command);
          broadcast();
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
