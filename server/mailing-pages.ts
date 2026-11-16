import type { IncomingMessage, ServerResponse } from 'node:http';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const unavailable =
  '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Tavi updates</title><main><h1>Link unavailable</h1><p>This link is invalid or temporarily unavailable. Please try again later.</p></main></html>';

/** Keep email pages on the website: Supabase rewrites hosted GET HTML to plain text. */
export function createMailingPageHandler(projectUrl: () => string, request: typeof fetch = fetch) {
  return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
    );
    req.resume();
    if (req.method !== 'GET' && req.method !== 'POST') {
      res.statusCode = 405;
      res.setHeader('Allow', 'GET, POST');
      res.end(unavailable);
      return;
    }
    try {
      const incoming = new URL(req.url ?? '/', 'https://tavi.invalid');
      const action =
        incoming.pathname === '/email/confirm'
          ? 'confirm'
          : incoming.pathname === '/email/unsubscribe'
            ? 'unsubscribe'
            : incoming.searchParams.get('action');
      const token = incoming.searchParams.get('token') ?? '';
      if ((action !== 'confirm' && action !== 'unsubscribe') || !uuid.test(token)) {
        res.statusCode = 400;
        res.end(unavailable);
        return;
      }
      const project = new URL(projectUrl());
      if (project.protocol !== 'https:') throw new Error('Invalid project URL');
      const upstream = `${project.origin}/functions/v1/mailing-email/${action}?token=${encodeURIComponent(token)}`;
      // Preserve the method. GET only displays a form; mutations require POST.
      const response = await request(upstream, {
        method: req.method,
        redirect: 'error',
        signal: AbortSignal.timeout(20000),
        headers: { Accept: 'text/html' },
      });
      const html = await response.text();
      if (!html.toLowerCase().startsWith('<!doctype html>'))
        throw new Error('Email page unavailable');
      res.statusCode = response.status;
      res.end(html);
    } catch {
      res.statusCode = 503;
      res.end(unavailable);
    }
  };
}
