import type { FastifyInstance } from 'fastify';

/** Bind first, then report the OS-assigned port: no probe-and-release race. */
export async function listenDesktop(app: FastifyInstance, preferred: number) {
  try {
    await app.listen({ host: '127.0.0.1', port: preferred });
  } catch (error) {
    if (!(error instanceof Error) || !('code' in error) || error.code !== 'EADDRINUSE') throw error;
    await app.listen({ host: '127.0.0.1', port: 0 });
  }
  const address = app.server.address();
  if (!address || typeof address === 'string')
    throw new Error('Desktop service has no TCP address.');
  return address.port;
}
