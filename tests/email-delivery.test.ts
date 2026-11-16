import { describe, expect, it, vi } from 'vitest';
import {
  createMailingHandler,
  type MailingSettings,
} from '../supabase/functions/_shared/mailing-handler';
import { renderEmail } from '../supabase/functions/_shared/templates';

const settings: MailingSettings = {
  supabaseUrl: 'https://example.supabase.co',
  serviceKey: 'server-only-test-key',
  resendKey: 're_test',
  sender: 'Tavi <app@example.com>',
  siteUrl: 'https://example.com',
  postalAddress: 'Test mailing address',
};
const token = '11111111-1111-4111-8111-111111111111';
const job = {
  id: token,
  lease: token,
  email: 'person@example.com',
  kind: 'welcome',
  confirmationToken: token,
  unsubscribeToken: token,
};
const processRequest = () =>
  new Request('https://example.supabase.co/functions/v1/mailing-email/process', {
    method: 'POST',
    headers: { Authorization: 'Bearer worker-test-token' },
  });
const response = (data: unknown) =>
  new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } });

describe('email delivery', () => {
  it('renders branded HTML and plain text with unsubscribe and attribution', async () => {
    for (const kind of ['confirmation', 'welcome', 'release']) {
      const result = await renderEmail(
        kind,
        {
          siteUrl: settings.siteUrl,
          postalAddress: settings.postalAddress,
          unsubscribeUrl: 'https://example.com/unsubscribe',
        },
        'https://example.com/confirm',
        {
          id: 'test',
          title: 'A new release',
          body: '<script>untrusted</script>',
          url: 'https://example.com/release',
        },
      );
      expect(result.html).toContain('tavi-wordmark.png');
      expect(result.html).toContain('/media/email/tavi-');
      expect(result.html).toContain('alisketch');
      expect(result.text).toContain('Unsubscribe');
      expect(result.html).not.toContain('<script>untrusted</script>');
      expect(result.html.length).toBeLessThan(100000);
    }
  });

  it('never consumes confirmation or unsubscribe tokens on GET', async () => {
    const fetcher = vi.fn<typeof fetch>();
    const handler = createMailingHandler(settings, fetcher);
    for (const action of ['confirm', 'unsubscribe']) {
      const result = await handler(
        new Request(
          `https://example.supabase.co/functions/v1/mailing-email/${action}?token=${token}`,
        ),
      );
      expect(result.status).toBe(200);
      expect(await result.text()).toContain('method="post"');
    }
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('confirms through the private service operation only after POST', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response(true));
    const handler = createMailingHandler(settings, fetcher);
    const result = await handler(
      new Request(`https://example.supabase.co/functions/v1/mailing-email/confirm?token=${token}`, {
        method: 'POST',
      }),
    );
    expect(await result.text()).toContain('You’re on the list');
    expect(fetcher.mock.calls[0]?.[0]).toBe(`${settings.supabaseUrl}/rest/v1/rpc/mailing_confirm`);
  });

  it('keeps jobs untouched while sender settings are incomplete', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response(true));
    const result = await createMailingHandler(
      { ...settings, sender: '' },
      fetcher,
    )(processRequest());
    expect(await result.json()).toEqual({
      status: 'paused',
      reason: 'Email sender is not configured',
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('rejects unauthenticated worker requests without claiming jobs', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response(false));
    const result = await createMailingHandler(settings, fetcher)(processRequest());
    expect(result.status).toBe(401);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('sends individually with an idempotency key, plain text, and one-click unsubscribe', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(response(true))
      .mockResolvedValueOnce(response([job]))
      .mockResolvedValueOnce(response(true))
      .mockResolvedValueOnce(response({ id: 'resend-test-id' }))
      .mockResolvedValueOnce(response(null));
    const result = await createMailingHandler(settings, fetcher)(processRequest());
    expect(await result.json()).toEqual({ sent: 1, failed: 0 });
    const delivery = fetcher.mock.calls[3];
    expect(delivery?.[0]).toBe('https://api.resend.com/emails');
    expect(new Headers(delivery?.[1]?.headers).get('Idempotency-Key')).toBe(`tavi/${token}`);
    const rawBody = delivery?.[1]?.body;
    if (typeof rawBody !== 'string') throw new Error('Expected a JSON request body');
    const body: unknown = JSON.parse(rawBody);
    expect(body).toMatchObject({
      to: ['person@example.com'],
      headers: { 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
    });
    expect(fetcher.mock.calls[4]?.[1]?.body).toContain('resend-test-id');
  });

  it('does not send a job cancelled after it was claimed', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(response(true))
      .mockResolvedValueOnce(response([job]))
      .mockResolvedValueOnce(response(false));
    const result = await createMailingHandler(settings, fetcher)(processRequest());
    expect(await result.json()).toEqual({ sent: 0, failed: 0 });
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it('records a retry without leaking provider bodies or credentials', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(response(true))
      .mockResolvedValueOnce(response([job]))
      .mockResolvedValueOnce(response(true))
      .mockResolvedValueOnce(new Response('sensitive-provider-body', { status: 429 }))
      .mockResolvedValueOnce(response(null));
    const result = await createMailingHandler(settings, fetcher)(processRequest());
    expect(await result.json()).toEqual({ sent: 0, failed: 1 });
    expect(fetcher.mock.calls[4]?.[1]?.body).toContain('resend_http_429');
    expect(fetcher.mock.calls[4]?.[1]?.body).not.toContain('sensitive-provider-body');
  });
});
