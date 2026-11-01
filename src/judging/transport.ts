export function isJudgingSession() {
  return new URLSearchParams(location.search).has('judge');
}
export function sessionUrl(path: string) {
  const url = new URL(path, location.origin);
  if (url.origin !== location.origin) throw new Error('Session links must be same-origin.');
  const params = new URLSearchParams(location.search);
  for (const key of ['judge', 'key']) {
    const value = params.get(key);
    if (value) url.searchParams.set(key, value);
  }
  return url.href;
}
export function fetchService(path: string, init?: RequestInit) {
  if (!path.startsWith('/api/')) throw new Error('Invalid service path.');
  return fetch(sessionUrl(path), init);
}
export function serviceSocketUrl() {
  const url = new URL(sessionUrl('/ws'));
  url.protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  return url.href;
}
