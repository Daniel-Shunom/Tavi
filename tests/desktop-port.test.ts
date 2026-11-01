import { afterEach, describe, expect, it } from 'vitest';
import Fastify from 'fastify';
import { createServer } from 'node:net';
import { listenDesktop } from '../desktop/listen';
import { createApp } from '../server/app';
const cleanups: (() => Promise<unknown>)[] = [];
afterEach(async () => {
  await Promise.all(cleanups.splice(0).map((close) => close()));
});
function app() {
  const value = Fastify();
  cleanups.push(() => value.close());
  return value;
}
describe('desktop port selection', () => {
  it('binds a free session port without disturbing the process holding the preferred port', async () => {
    const occupied = createServer();
    await new Promise<void>((resolve) => occupied.listen(0, '127.0.0.1', resolve));
    cleanups.push(
      () =>
        new Promise<void>((resolve, reject) =>
          occupied.close((error) => {
            if (error) reject(error);
            else resolve();
          }),
        ),
    );
    const address = occupied.address();
    if (!address || typeof address === 'string') throw new Error('No test address');
    const desktop = app();
    desktop.get('/health', () => ({ ownService: true }));
    const port = await listenDesktop(desktop, address.port);
    expect(port).not.toBe(address.port);
    expect(port).toBeGreaterThan(0);
    expect(occupied.listening).toBe(true);
    expect(await (await fetch(`http://127.0.0.1:${String(port)}/health`)).json()).toEqual({
      ownService: true,
    });
  });
  it('keeps an available preferred port and assigns distinct simultaneous automatic ports', async () => {
    const first = app();
    const preferred = await listenDesktop(first, 0);
    await first.close();
    const replacement = app();
    expect(await listenDesktop(replacement, preferred)).toBe(preferred);
    const ports = await Promise.all([listenDesktop(app(), 0), listenDesktop(app(), 0)]);
    expect(ports[0]).not.toBe(ports[1]);
  });
  it('does not mask non-conflict listen errors', async () => {
    await expect(listenDesktop(app(), -1)).rejects.toBeDefined();
  });
  it('trusts the selected origin after binding without trusting arbitrary loopback ports', async () => {
    let port = 0;
    const desktop = await createApp(undefined, undefined, {}, () =>
      port ? [`http://127.0.0.1:${String(port)}`] : [],
    );
    cleanups.push(() => desktop.close());
    const request = (origin: string) =>
      desktop.inject({
        method: 'POST',
        url: '/api/twitch/disconnect',
        headers: { origin, 'x-tavi-request': 'studio' },
      });
    expect((await request('http://127.0.0.1:49152')).statusCode).toBe(403);
    const blocker = createServer();
    await new Promise<void>((resolve) => blocker.listen(0, '127.0.0.1', resolve));
    cleanups.push(
      () =>
        new Promise<void>((resolve, reject) =>
          blocker.close((error) => {
            if (error) reject(error);
            else resolve();
          }),
        ),
    );
    const blocked = blocker.address();
    if (!blocked || typeof blocked === 'string') throw new Error('No blocker address');
    port = await listenDesktop(desktop, blocked.port);
    expect(port).not.toBe(blocked.port);
    expect((await request(`http://127.0.0.1:${String(port)}`)).statusCode).toBe(200);
    expect(
      (await request(`http://127.0.0.1:${String(port === 65535 ? 65534 : port + 1)}`)).statusCode,
    ).toBe(403);
    const socket = await desktop.injectWS('/ws', {
      headers: { origin: `http://127.0.0.1:${String(port)}` },
    });
    socket.close();
  });
});
