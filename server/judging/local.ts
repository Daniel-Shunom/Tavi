import { randomBytes } from 'node:crypto';
import { resolve } from 'node:path';
import serveStatic from '@fastify/static';
import { MemorySessionStore } from './memory-store.js';
import { RedisSessionStore } from './redis-store.js';
import { JudgingSessions } from './sessions.js';
import { JudgingWorker } from './worker.js';
import { createJudgingApi } from './api.js';

const port = Number(process.env['JUDGING_PORT'] ?? 44910);
const origin = `http://127.0.0.1:${String(port)}`;
const store = process.env['REDIS_URL']
  ? new RedisSessionStore(process.env['REDIS_URL'])
  : new MemorySessionStore();
if (store instanceof RedisSessionStore) await store.connect();
const worker = new JudgingWorker(store, origin);
await worker.start();
const sessions = new JudgingSessions(store, origin, randomBytes(32).toString('base64url'));
const app = await createJudgingApi(sessions);
await app.register(serveStatic, { root: resolve('dist'), wildcard: true });
for (const path of ['/judge', '/studio', '/overlay', '/dock', '/download'])
  app.get(path, (_, reply) =>
    reply.header('Referrer-Policy', 'no-referrer').sendFile('index.html'),
  );
app.addHook('onClose', async () => {
  await worker.close();
  await store.close();
});
await app.listen({ port, host: '127.0.0.1' });
console.info(
  `Judging preview: ${origin}/judge (${store instanceof RedisSessionStore ? 'Redis' : 'local memory'})`,
);
for (const signal of ['SIGINT', 'SIGTERM'] as const)
  process.on(signal, () => {
    void app.close();
  });
