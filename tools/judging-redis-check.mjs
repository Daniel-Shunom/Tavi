import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { createClient } from '@redis/client';
import { RedisSessionStore, redisConnectionUrl } from '../server/judging/redis-store.ts';
import { JudgingWorker } from '../server/judging/worker.ts';
import { JudgingSessions } from '../server/judging/sessions.ts';
import { stateSchema } from '../shared/protocol.ts';

// This uses a disposable namespace only. It never reads or changes real visitor sessions.
process.loadEnvFile(process.argv[2] ?? '.env.judging.local');
const redisUrl = process.env.UPSTASH_REDIS_URL ?? process.env.REDIS_URL;
assert(redisUrl, 'Set UPSTASH_REDIS_URL or REDIS_URL in the ignored environment file.');
const namespace = `tavi:verify:${randomUUID()}`;
const url = redisConnectionUrl(redisUrl);
const apiStore = new RedisSessionStore(url, namespace, 2);
const workerStore = new RedisSessionStore(url, namespace, 2);
const inspect = createClient({ url, socket: { connectTimeout: 5000 }, disableOfflineQueue: true });
inspect.on('error', () => undefined);
const worker = new JudgingWorker(workerStore, 'https://judging-verification.invalid');
const sessions = new JudgingSessions(
  apiStore,
  'https://judging-verification.invalid',
  randomBytes(32).toString('base64url'),
);
const ids = [];
const timeout = setTimeout(() => {
  console.error('Redis verification timed out. No connection credentials were printed.');
  process.exit(1);
}, 60000);
function access(link) {
  const query = new URL(link).searchParams;
  return sessions.authenticate(query.get('judge'), query.get('key'));
}
try {
  await Promise.all([apiStore.connect(), workerStore.connect(), inspect.connect()]);
  assert.equal(await inspect.ping(), 'PONG');
  console.info('PASS encrypted Redis connection');
  const attempts = await Promise.all(
    Array.from({ length: 8 }, (_, i) =>
      (i % 2 ? workerStore : apiStore).allowCreation('synthetic-client'),
    ),
  );
  assert.equal(attempts.filter(Boolean).length, 5);
  assert((await inspect.pTTL(`${namespace}:creation:synthetic-client`)) > 1790000);
  assert.equal(await apiStore.allowCreation('another-client'), true);
  console.info('PASS atomic per-client creation limits across store instances');
  await worker.start();
  const first = await sessions.create();
  ids.push(first.session.id);
  const second = await sessions.create();
  ids.push(second.session.id);
  const owner = await access(first.studioUrl);
  const other = await access(second.studioUrl);
  const viewer = await access(first.session.overlayUrl);
  stateSchema.parse((await sessions.snapshot(owner)).packet.state);
  await sessions.command(owner, { type: 'configure', patch: { name: 'Redis verification one' } });
  assert.equal((await sessions.snapshot(owner)).packet.state.config.name, 'Redis verification one');
  assert.notEqual(
    (await sessions.snapshot(other)).packet.state.config.name,
    'Redis verification one',
  );
  await assert.rejects(sessions.command(viewer, { type: 'quiet', value: true }), { status: 403 });
  await assert.rejects(sessions.create(), { status: 503 });
  const metaKey = `${namespace}:${first.session.id}:meta`;
  const stateKey = `${namespace}:${first.session.id}:state`;
  const initialTtl = await inspect.pTTL(metaKey);
  assert(initialTtl > 1790000 && initialTtl <= 1800000, 'Initial Redis TTL must be 30 minutes.');
  const extensions = await Promise.allSettled([sessions.extend(owner), sessions.extend(owner)]);
  assert.equal(extensions.filter((result) => result.status === 'fulfilled').length, 1);
  const extended = await sessions.status(owner);
  assert.equal(extended.expiresAt - extended.createdAt, 2700000);
  const snapshot = await sessions.snapshot(owner);
  const reset = await sessions.reset(owner);
  assert.equal(reset.epoch, 1);
  assert.equal(reset.expiresAt, extended.expiresAt);
  assert.equal(await apiStore.save(first.session.id, 0, snapshot.packet), null);
  stateSchema.parse((await sessions.snapshot(owner)).packet.state);
  assert((await inspect.pTTL(stateKey)) > 2690000, 'Reset must retain the extended absolute TTL.');
  console.info(
    'PASS worker RPC, state schema, isolation, view-only access, capacity, extension, reset, stale-write rejection',
  );

  // Shorten only this synthetic record, then let the real Redis TTL and worker timer run unattended.
  const record = await apiStore.get(first.session.id);
  const redisTime = await inspect.sendCommand(['TIME']);
  record.expiresAt = Number(redisTime[0]) * 1000 + Math.floor(Number(redisTime[1]) / 1000) + 2500;
  await inspect.set(metaKey, JSON.stringify(record), { PXAT: record.expiresAt });
  await inspect.pExpireAt(stateKey, record.expiresAt);
  assert.equal(
    (await apiStore.request({ id: randomUUID(), sessionId: record.id, action: 'ensure' })).status,
    200,
  );
  await delay(2800);
  assert.equal(
    await inspect.exists([metaKey, stateKey]),
    0,
    'Redis must remove both keys without browser activity.',
  );
  await assert.rejects(sessions.status(owner), { status: 410 });
  await assert.rejects(sessions.extend(owner), { status: 410 });
  console.info('PASS real Redis expiration and expired capability rejection');
} finally {
  await worker.close();
  await Promise.allSettled(ids.map((id) => apiStore.end(id)));
  await inspect.del(`${namespace}:active`).catch(() => undefined);
  await inspect
    .del([`${namespace}:creation:synthetic-client`, `${namespace}:creation:another-client`])
    .catch(() => undefined);
  await Promise.allSettled([apiStore.close(), workerStore.close(), inspect.close()]);
  clearTimeout(timeout);
}
