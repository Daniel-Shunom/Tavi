import { renderEmail } from './templates.tsx';
import type { ReleaseContent } from './templates.tsx';

export interface MailingSettings {
  supabaseUrl: string;
  serviceKey: string;
  resendKey: string;
  sender: string;
  siteUrl: string;
  postalAddress: string;
}

interface Job {
  id: string;
  lease: string;
  email: string;
  kind: string;
  confirmationToken: string;
  unsubscribeToken: string;
  release?: ReleaseContent;
}

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

function page(title: string, message: string, action?: string) {
  const html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${title} · Tavi</title><style>body{font-family:system-ui,sans-serif;color:#30203c;background:#f3eff6;margin:0;padding:48px 24px}main{max-width:480px;margin:40px auto;background:white;padding:32px;border-radius:16px}h1{font-family:Georgia,serif;font-size:36px;font-weight:400}p{line-height:1.6}button{padding:12px 24px;border:0;border-radius:8px;background:#30203c;color:white;font:inherit;cursor:pointer}button:focus-visible{outline:3px solid #b9a5db;outline-offset:4px}</style><main><strong>tavi ✦</strong><h1>${title}</h1><p>${message}</p>${action ? `<form method="post"><button type="submit">${action}</button></form>` : ''}</main></html>`;
  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'Referrer-Policy': 'no-referrer',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy':
        "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
    },
  });
}

export function deliveryConfigured(settings: MailingSettings): boolean {
  try {
    return (
      settings.resendKey.startsWith('re_') &&
      settings.sender.includes('@') &&
      new URL(settings.siteUrl).protocol === 'https:' &&
      !!settings.postalAddress.trim()
    );
  } catch {
    return false;
  }
}

export function createMailingHandler(settings: MailingSettings, request: typeof fetch = fetch) {
  async function rpc(name: string, args: Record<string, unknown> = {}): Promise<unknown> {
    const response = await request(`${settings.supabaseUrl}/rest/v1/rpc/${name}`, {
      method: 'POST',
      headers: {
        apikey: settings.serviceKey,
        Authorization: `Bearer ${settings.serviceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(args),
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error('Database operation failed');
    const text = await response.text();
    return text ? (JSON.parse(text) as unknown) : null;
  }

  return async (req: Request): Promise<Response> => {
    const url = new URL(req.url);
    const action = url.pathname.split('/').pop();
    try {
      if (action === 'status' && req.method === 'GET') {
        const missing = [
          !settings.resendKey && 'RESEND_API_KEY',
          !settings.sender && 'TAVI_EMAIL_FROM',
          !settings.siteUrl && 'TAVI_PUBLIC_URL',
          !settings.postalAddress && 'TAVI_POSTAL_ADDRESS',
        ].filter(Boolean);
        return json({
          status: deliveryConfigured(settings) ? 'configuration_ready' : 'paused',
          missing,
        });
      }
      if (action === 'confirm' || action === 'unsubscribe') {
        const token = url.searchParams.get('token') ?? '';
        if (!uuid.test(token))
          return page('Link unavailable', 'This link is incomplete or invalid.');
        // GET only displays a form: inbox scanners must not confirm or unsubscribe anyone.
        if (req.method === 'GET') {
          return action === 'confirm'
            ? page(
                'A little news from Tavi.',
                'Confirm that you want Tavi releases and updates by email.',
                'Confirm my email',
              )
            : page(
                'Leave the mailing list?',
                'You can stop Tavi releases and updates here.',
                'Unsubscribe',
              );
        }
        if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
        const valid = await rpc(
          action === 'confirm' ? 'mailing_confirm' : 'mailing_unsubscribe',
          action === 'confirm' ? { confirmation: token } : { unsubscribe: token },
        );
        if (valid !== true)
          return page('Link unavailable', 'This link has expired or is no longer active.');
        return action === 'confirm'
          ? page(
              'You’re on the list.',
              'Your email is confirmed. We’ll write when there’s something new to share.',
            )
          : page('You’re unsubscribed.', 'You won’t receive any more Tavi releases or updates.');
      }
      if (action !== 'process') return json({ error: 'Not found' }, 404);
      if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
      const token = req.headers.get('Authorization')?.replace(/^Bearer /, '') ?? '';
      if (!token || (await rpc('mailing_worker_authorized', { worker_token: token })) !== true) {
        return json({ error: 'Unauthorized' }, 401);
      }
      if (!deliveryConfigured(settings))
        return json({ status: 'paused', reason: 'Email sender is not configured' });
      const jobs = (await rpc('mailing_claim_jobs')) as Job[];
      let sent = 0;
      let failed = 0;
      for (const job of jobs) {
        try {
          const allowed = await rpc('mailing_job_allowed', {
            job_id: job.id,
            job_lease: job.lease,
          });
          if (allowed !== true) continue;
          const base = `${settings.supabaseUrl}/functions/v1/mailing-email`;
          const unsubscribeUrl = `${base}/unsubscribe?token=${job.unsubscribeToken}`;
          const email = await renderEmail(
            job.kind,
            {
              siteUrl: settings.siteUrl,
              unsubscribeUrl,
              postalAddress: settings.postalAddress,
            },
            `${base}/confirm?token=${job.confirmationToken}`,
            job.release,
          );
          const response = await request('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${settings.resendKey}`,
              'Content-Type': 'application/json',
              'Idempotency-Key': `tavi/${job.id}`,
            },
            body: JSON.stringify({
              from: settings.sender,
              to: [job.email],
              ...email,
              headers: {
                'List-Unsubscribe': `<${unsubscribeUrl}>`,
                'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
              },
            }),
            signal: AbortSignal.timeout(10000),
          });
          if (!response.ok) throw new Error(`resend_http_${String(response.status)}`);
          const result = (await response.json()) as { id?: unknown };
          if (typeof result.id !== 'string') throw new Error('resend_invalid_response');
          await rpc('mailing_finish_job', {
            job_id: job.id,
            job_lease: job.lease,
            sent_id: result.id,
            error_code: null,
          });
          sent++;
        } catch (error) {
          const code =
            error instanceof Error && /^resend_http_\d+$/.test(error.message)
              ? error.message
              : 'delivery_failed';
          await rpc('mailing_finish_job', {
            job_id: job.id,
            job_lease: job.lease,
            sent_id: null,
            error_code: code,
          });
          failed++;
        }
      }
      return json({ sent, failed });
    } catch {
      // Responses and logs never contain API keys, email addresses, or private tokens.
      return json(
        { error: 'The email service is temporarily unavailable. Please try again.' },
        503,
      );
    }
  };
}
