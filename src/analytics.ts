import { track } from '@vercel/analytics';

const localHosts = new Set(['localhost', '127.0.0.1', 'tauri.localhost']);
const enabled =
  import.meta.env.PROD &&
  typeof window !== 'undefined' &&
  !localHosts.has(window.location.hostname);

/** Track aggregate product actions without sending user-entered or account data. */
export function trackProductEvent(
  name: string,
  properties?: Record<string, string | number | boolean>,
) {
  if (enabled) track(name, properties);
}
