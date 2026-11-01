import { RedisSessionStore } from './redis-store.js';
import { JudgingWorker } from './worker.js';
import { requiredEnvironment, requiredRedisEnvironment } from './environment.js';

const store = new RedisSessionStore(requiredRedisEnvironment(), process.env['JUDGING_NAMESPACE']);
await store.connect();
const worker = new JudgingWorker(store, requiredEnvironment('JUDGING_PUBLIC_ORIGIN'));
let closing = false;
async function close() {
  if (closing) return;
  closing = true;
  // The worker synchronously clears local credentials before it awaits Redis or Twitch.
  await worker.close();
  await store.close();
}
for (const signal of ['SIGINT', 'SIGTERM'] as const)
  process.on(signal, () => {
    void close().finally(() => process.exit(0));
  });
try {
  await worker.start();
  console.info('Tavi judging worker ready.');
} catch {
  await close();
  console.error('Judging worker could not start. Check Redis and the worker lease.');
  process.exitCode = 1;
}
