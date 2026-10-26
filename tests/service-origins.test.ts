import { it, expect } from 'vitest';
import WebSocket from 'ws';
import { createApp } from '../server/app';

function firstEvent(url: string, origin: string) {
  return new Promise<'message' | number>((resolve, reject) => {
    const socket = new WebSocket(url, { origin });
    const timeout = setTimeout(() => {
      socket.terminate();
      reject(new Error('Timed out waiting for the socket'));
    }, 3000);
    socket.once('message', () => {
      clearTimeout(timeout);
      socket.close();
      resolve('message');
    });
    socket.once('close', (code) => {
      clearTimeout(timeout);
      resolve(code);
    });
  });
}

it('trusts extra origins for a service on a non-default port and still rejects others', async () => {
  const app = await createApp(undefined, undefined, {}, ['http://127.0.0.1:4400']);
  await app.listen({ host: '127.0.0.1', port: 0 });
  const url = `ws://127.0.0.1:${String((app.server.address() as { port: number }).port)}/ws`;
  try {
    expect(await firstEvent(url, 'http://127.0.0.1:4400')).toBe('message');
    expect(await firstEvent(url, 'http://127.0.0.1:4318')).toBe('message');
    expect(await firstEvent(url, 'http://127.0.0.1:4401')).toBe(1008);
    const headers = { origin: 'http://127.0.0.1:4401', 'x-tavi-request': 'studio' };
    const denied = await app.inject({ method: 'POST', url: '/api/twitch/disconnect', headers });
    expect(denied.statusCode).toBe(403);
  } finally {
    await app.close();
  }
});
