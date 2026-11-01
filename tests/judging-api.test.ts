import { afterEach, expect, it } from 'vitest';
import { MemorySessionStore } from '../server/judging/memory-store';
import { JudgingWorker } from '../server/judging/worker';
import { JudgingSessions } from '../server/judging/sessions';
import { createJudgingApi } from '../server/judging/api';
import { decodeFrame } from '../server/decode';

const cleanups: (() => Promise<void>)[] = [];
afterEach(async () => {
  await Promise.all(cleanups.splice(0).map((close) => close()));
});
const origin = 'http://127.0.0.1:44910';
const headers = { origin, 'x-tavi-request': 'studio' };
async function fixture() {
  const store = new MemorySessionStore();
  const worker = new JudgingWorker(store, origin);
  await worker.start();
  const sessions = new JudgingSessions(store, origin, 'local-test-secret'.repeat(3));
  const app = await createJudgingApi(sessions);
  await app.ready();
  cleanups.push(async () => {
    await app.close();
    await worker.close();
    await store.close();
  });
  const response = await app.inject({ method: 'POST', url: '/api/judging/sessions', headers });
  expect(response.statusCode).toBe(200);
  const created = response.json<{ studioUrl: string; session: { overlayUrl: string } }>();
  const control = new URL(created.studioUrl).search;
  const view = new URL(created.session.overlayUrl).search;
  return { app, sessions, control, view };
}
it('requires same-origin mutations and confines controller APIs to their own session', async () => {
  const { app, control, view } = await fixture();
  expect((await app.inject({ method: 'POST', url: '/api/judging/sessions' })).statusCode).toBe(403);
  expect((await app.inject('/api/state')).statusCode).toBe(401);
  expect((await app.inject(`/api/state${view}`)).statusCode).toBe(200);
  expect((await app.inject(`/api/twitch${view}`)).statusCode).toBe(403);
  expect(
    (await app.inject({ method: 'POST', url: `/api/judging/reset${view}`, headers })).statusCode,
  ).toBe(403);
  expect(
    (await app.inject({ method: 'POST', url: `/api/judging/reset${control}`, headers })).statusCode,
  ).toBe(200);
  // Exercise the same rewritten request shape used by the Vercel function.
  expect((await app.inject(`/api/server${control}&path=judging/session`)).statusCode).toBe(200);
});
it('synchronizes the overlay over WebSocket while rejecting overlay commands', async () => {
  const { app, sessions, control, view } = await fixture();
  const socket = await app.injectWS(`/ws${view}`);
  try {
    const updated = new Promise<void>((resolve) => {
      socket.on('message', (data) => {
        const packet = JSON.parse(decodeFrame(data)) as {
          type: string;
          state?: { config: { name: string } };
        };
        if (packet.state?.config.name === 'My judging Tavi') resolve();
      });
    });
    const params = new URLSearchParams(control);
    const access = await sessions.authenticate(params.get('judge'), params.get('key'));
    await sessions.command(access, { type: 'configure', patch: { name: 'My judging Tavi' } });
    await updated;
    const rejected = new Promise<void>((resolve) => {
      socket.on('message', (data) => {
        const packet = JSON.parse(decodeFrame(data)) as { type: string; message?: string };
        if (packet.type === 'error' && packet.message?.includes('view-only')) resolve();
      });
    });
    socket.send(JSON.stringify({ type: 'quiet', value: true }));
    await rejected;
    expect((await sessions.snapshot(access)).packet.state.quiet).toBe(false);
  } finally {
    socket.terminate();
  }
});
