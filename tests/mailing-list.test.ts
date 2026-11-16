import { afterEach, describe, expect, it, vi } from 'vitest';
import { joinMailingList, mailingListConfig } from '../src/landing/mailingList';

const config = { url: 'https://example.supabase.co', publishableKey: 'sb_publishable_test' };
afterEach(() => vi.unstubAllEnvs());

describe('mailing list boundary', () => {
  it('requires consent and a valid email before making a request', async () => {
    const request = vi.fn<typeof fetch>();
    await expect(joinMailingList(config, 'person@example.com', false, request)).rejects.toThrow(
      'agree',
    );
    await expect(joinMailingList(config, 'not-an-email', true, request)).rejects.toThrow(
      'valid email',
    );
    expect(request).not.toHaveBeenCalled();
  });

  it('stores a normalized email and consent without requesting subscriber data', async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 201 }));
    await joinMailingList(config, ' Person@Example.com ', true, request);
    const call = request.mock.calls[0];
    expect(call?.[0]).toBe('https://example.supabase.co/rest/v1/mailing_list_subscribers');
    const options = call?.[1];
    expect(options?.method).toBe('POST');
    const headers = new Headers(options?.headers);
    expect(headers.get('apikey')).toBe('sb_publishable_test');
    expect(headers.get('Prefer')).toBe('return=minimal');
    expect(options?.body).toBe(
      JSON.stringify({ email: 'person@example.com', consent_version: 'release-updates-v1' }),
    );
  });

  it('confirms a duplicate without updating the original consent', async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify({ code: '23505' }), { status: 409 }));
    await expect(
      joinMailingList(config, 'person@example.com', true, request),
    ).resolves.toBeUndefined();
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('does not claim success for permission failures or unrelated conflicts', async () => {
    for (const status of [403, 409, 500]) {
      const request = vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response(JSON.stringify({ code: '42501' }), { status }));
      await expect(joinMailingList(config, 'person@example.com', true, request)).rejects.toThrow(
        'could not be saved',
      );
    }
  });

  it('disables signup with absent config or a secret key in the public setting', () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', '');
    expect(mailingListConfig()).toBeNull();
    vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', 'sb_secret_do_not_expose');
    expect(mailingListConfig()).toBeNull();
    vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_test');
    expect(mailingListConfig()).toEqual(config);
    vi.stubEnv('VITE_SUPABASE_URL', 'http://example.supabase.co');
    expect(mailingListConfig()).toBeNull();
  });
});
