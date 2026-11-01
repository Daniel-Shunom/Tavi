import { RedisSessionStore } from '../server/judging/redis-store.js';
import { JudgingSessions } from '../server/judging/sessions.js';
import { createJudgingApi } from '../server/judging/api.js';
import { requiredEnvironment } from '../server/judging/environment.js';

// Preview deployments cannot share production capabilities or its production-only daemon.
if (process.env['VERCEL_ENV'] && process.env['VERCEL_ENV'] !== 'production')
  throw new Error('Judging sessions are available on the production deployment only.');
const store = new RedisSessionStore(
  requiredEnvironment('REDIS_URL'),
  process.env['JUDGING_NAMESPACE'],
);
await store.connect();
const sessions = new JudgingSessions(
  store,
  requiredEnvironment('JUDGING_PUBLIC_ORIGIN'),
  requiredEnvironment('JUDGING_SECRET'),
);
const app = await createJudgingApi(sessions);
await app.ready();
export default app.server;
