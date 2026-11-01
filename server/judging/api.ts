import Fastify from 'fastify';
import websocket from '@fastify/websocket';
import type { WebSocket } from 'ws';
import { ZodError } from 'zod';
import { decodeFrame } from '../decode.js';
import { JudgingSessions } from './sessions.js';
import { JudgingError, type SessionEvent } from './types.js';

export async function createJudgingApi(sessions: JudgingSessions) {
  const app = Fastify({ logger: false, bodyLimit: 16384 });
  const sockets = new Set<WebSocket>();
  await app.register(websocket, { options: { maxPayload: 16384 } });
  app.addHook('onRequest', async (_, reply) => {
    reply.header('Cache-Control', 'no-store');
    reply.header('Referrer-Policy', 'no-referrer');
  });
  app.setErrorHandler((error, _, reply) => {
    const status =
      error instanceof JudgingError ? error.status : error instanceof ZodError ? 400 : 503;
    return reply.code(status).send({
      error:
        error instanceof JudgingError
          ? error.message
          : status === 400
            ? 'Check the preview action and try again.'
            : 'Preview is reconnecting. Try again shortly.',
    });
  });
  function parse(raw: string) {
    const url = new URL(raw, sessions.origin);
    const rewritten = url.pathname === '/api/server' ? url.searchParams.get('path') : null;
    const path = rewritten ? (rewritten === 'ws' ? '/ws' : `/api/${rewritten}`) : url.pathname;
    return { url, path };
  }
  async function http(request: {
    url: string;
    method: string;
    body?: unknown;
    headers: Record<string, string | string[] | undefined>;
  }) {
    const { url, path } = parse(request.url);
    if (
      request.method === 'POST' &&
      (request.headers['origin'] !== sessions.origin ||
        request.headers['x-tavi-request'] !== 'studio')
    )
      throw new JudgingError(403, 'Open this action from Tavi Studio.');
    if (path === '/api/health') return { status: 'ok', mode: 'judging' };
    if (path === '/api/judging/sessions' && request.method === 'POST') return sessions.create();
    const access = await sessions.authenticate(
      url.searchParams.get('judge'),
      url.searchParams.get('key'),
    );
    if (path === '/api/judging/session' && request.method === 'GET') return sessions.status(access);
    if (path === '/api/judging/extend' && request.method === 'POST') return sessions.extend(access);
    if (path === '/api/judging/reset' && request.method === 'POST') return sessions.reset(access);
    if (path === '/api/state' && request.method === 'GET')
      return (await sessions.snapshot(access)).packet.state;
    if (request.method !== 'GET' && request.method !== 'POST')
      throw new JudgingError(405, 'Unknown preview action.');
    return (await sessions.http(access, request.method, path, request.body)).body;
  }
  function socket(
    socket: WebSocket,
    request: { url: string; headers: { origin?: string | undefined } },
  ) {
    if (
      parse(request.url).path !== '/ws' ||
      (request.headers.origin && request.headers.origin !== sessions.origin)
    ) {
      socket.close(1008, 'Invalid preview origin');
      return;
    }
    sockets.add(socket);
    const lifetime = new AbortController();
    const stopped = () => lifetime.signal.aborted;
    let stop: (() => Promise<void>) | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let revision = -1;
    let initialized = false;
    const buffered: SessionEvent[] = [];
    function end() {
      socket.close(1008, 'Preview ended');
    }
    function schedule(expiresAt: number) {
      clearTimeout(timer);
      timer = setTimeout(end, Math.max(0, expiresAt - sessions.store.now()));
      timer.unref();
    }
    const ready = (async () => {
      const { url } = parse(request.url);
      const access = await sessions.authenticate(
        url.searchParams.get('judge'),
        url.searchParams.get('key'),
      );
      function event(event: SessionEvent) {
        if (stopped()) return;
        if (!initialized) {
          buffered.push(event);
          return;
        }
        if (event.type === 'ended') {
          end();
          return;
        }
        if (event.type === 'metadata') {
          void sessions
            .status(access)
            .then((meta) => {
              schedule(meta.expiresAt);
            })
            .catch(end);
          return;
        }
        if (event.snapshot.revision <= revision || socket.readyState !== 1) return;
        revision = event.snapshot.revision;
        socket.send(JSON.stringify(event.snapshot.packet));
      }
      stop = await sessions.store.subscribe(access.record.id, event);
      if (stopped()) {
        await stop();
        return access;
      }
      const snapshot = await sessions.snapshot(access);
      const metadata = await sessions.status(access);
      if (stopped()) {
        await stop();
        return access;
      }
      schedule(metadata.expiresAt);
      initialized = true;
      event({ type: 'state', snapshot });
      for (const update of buffered.splice(0)) event(update);
      return access;
    })();
    void ready.catch(end);
    let commands = Promise.resolve();
    socket.on('message', (raw) => {
      commands = commands
        .then(async () => {
          const access = await ready;
          if (!stopped()) await sessions.command(access, JSON.parse(decodeFrame(raw)) as unknown);
        })
        .catch((error: unknown) => {
          if (error instanceof JudgingError && error.status === 410) end();
          else if (socket.readyState === 1)
            socket.send(
              JSON.stringify({
                type: 'error',
                message:
                  error instanceof JudgingError
                    ? error.message
                    : 'Could not apply this preview action.',
              }),
            );
        });
    });
    socket.on('close', () => {
      lifetime.abort();
      sockets.delete(socket);
      clearTimeout(timer);
      if (stop) void stop().catch(() => undefined);
    });
  }
  app.get('/ws', { websocket: true }, socket);
  app.route({ method: 'GET', url: '/api/server', handler: http, wsHandler: socket });
  app.post('/api/server', http);
  app.get('/api/*', http);
  app.post('/api/*', http);
  app.addHook('preClose', () => {
    for (const socket of sockets) socket.close(1001, 'Server restarting');
    return Promise.resolve();
  });
  return app;
}
