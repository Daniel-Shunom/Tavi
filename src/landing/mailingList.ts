export const RELEASE_UPDATES_CONSENT = 'release-updates-v1';

export interface MailingListConfig {
  url: string;
  publishableKey: string;
}

export function mailingListConfig(): MailingListConfig | null {
  const url: unknown = import.meta.env['VITE_SUPABASE_URL'];
  const publishableKey: unknown = import.meta.env['VITE_SUPABASE_PUBLISHABLE_KEY'];
  if (typeof url !== 'string' || typeof publishableKey !== 'string') return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' || !publishableKey.startsWith('sb_publishable_')) return null;
    return { url: parsed.origin, publishableKey };
  } catch {
    return null;
  }
}

export async function joinMailingList(
  config: MailingListConfig,
  email: string,
  consent: boolean,
  request: typeof fetch = fetch,
): Promise<void> {
  const normalized = email.trim().toLowerCase();
  if (!consent) throw new Error('Please agree to receive Tavi releases and updates.');
  if (normalized.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    throw new Error('Enter a valid email address.');
  }
  const response = await request(`${config.url}/rest/v1/mailing_list_subscribers`, {
    method: 'POST',
    headers: {
      apikey: config.publishableKey,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({ email: normalized, consent_version: RELEASE_UPDATES_CONSENT }),
    signal: AbortSignal.timeout(15000),
  });
  if (response.ok) return;
  // An existing opt-in gets the same confirmation, without changing its consent record.
  if (response.status === 409) {
    const detail: unknown = await response.json();
    if (
      typeof detail === 'object' &&
      detail !== null &&
      'code' in detail &&
      detail.code === '23505'
    ) {
      return;
    }
  }
  throw new Error('Signup could not be saved. Please try again.');
}
