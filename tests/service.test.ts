import { it, expect } from 'vitest';
import WebSocket from 'ws';
import { createApp } from '../server/app';
import { decodeFrame } from '../server/decode';
import { serverMessageSchema, stateSchema } from '../shared/protocol';
import { z } from 'zod';
const stateMessage = z.object({ type: z.literal('state'), state: stateSchema });
function next(socket: WebSocket) {
  return new Promise<z.infer<typeof serverMessageSchema>>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Timed out waiting for server update'));
    }, 3000);
    socket.once('message', (data) => {
      clearTimeout(timeout);
      resolve(serverMessageSchema.parse(JSON.parse(decodeFrame(data))));
    });
  });
}
it('synchronizes studio and overlay, rejects invalid changes, and restores latest state on reconnect', async () => {
  const app = await createApp();
  await app.listen({ host: '127.0.0.1', port: 0 });
  const port = (app.server.address() as { port: number }).port;
  const studio = new WebSocket(`ws://127.0.0.1:${String(port)}/ws`);
  const initial = stateMessage.parse(await next(studio));
  const overlay = new WebSocket(`ws://127.0.0.1:${String(port)}/ws`);
  await next(overlay);
  try {
    expect(initial.state.config.name).toBe('Tavi');
    const studioUpdate = next(studio),
      overlayUpdate = next(overlay);
    studio.send(
      JSON.stringify({ type: 'configure', patch: { name: 'Mochi', personality: 'shy' } }),
    );
    expect(stateMessage.parse(await studioUpdate).state.config.name).toBe('Mochi');
    expect(stateMessage.parse(await overlayUpdate).state.config.personality).toBe('shy');
    const error = next(studio);
    studio.send(JSON.stringify({ type: 'configure', patch: { x: 10 } }));
    expect((await error).type).toBe('error');
    const returning = new WebSocket(`ws://127.0.0.1:${String(port)}/ws`);
    expect(stateMessage.parse(await next(returning)).state.config.name).toBe('Mochi');
    returning.close();
  } finally {
    studio.close();
    overlay.close();
    await app.close();
  }
});
