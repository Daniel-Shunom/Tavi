export function requiredEnvironment(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Set ${name} before starting the judging service.`);
  return value;
}

/** Prefer the TLS-enabled Marketplace Redis URL in hosted deployments. */
export function requiredRedisEnvironment() {
  const value = process.env['UPSTASH_REDIS_URL'] ?? process.env['REDIS_URL'];
  if (!value) throw new Error('Set UPSTASH_REDIS_URL (or REDIS_URL for local Redis) first.');
  return value;
}
