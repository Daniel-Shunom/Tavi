import { afterEach, describe, expect, it, vi } from 'vitest';
import { createServer, type Server } from 'node:http';
import { createMailingPageHandler } from '../../server/mailing-pages';
import vercel from '../../vercel.json' with { type: 'json' };

const token = '11111111-1111-4111-8111-111111111111';
const servers: Server[] = [];
const html =
  '<!doctype html><html><form method="post"><button>Confirm my email</button></form></html>';
afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise<void>((resolve) => {
          server.close(() => {
            resolve();
          });
          server.closeAllConnections();
        }),
    ),
  );
});
async function listen(request: typeof fetch, project = 'https://example.supabase.co') {
  const handler = createMailingPageHandler(() => project, request);
  const server = createServer((req, res) => {
    void handler(req, res);
  });
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('No test server address');
  return `http://127.0.0.1:${String(address.port)}`;
}

describe('website email pages', () => {
  it('serves Supabase GET HTML as HTML on the website without performing a POST', async () => {
    const upstream = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(html, { headers: { 'Content-Type': 'text/plain' } }));
    const base = await listen(upstream);
    const result = await fetch(`${base}/email/confirm?token=${token}`);
    expect(result.headers.get('content-type')).toBe('text/html; charset=utf-8');
    expect(result.headers.get('referrer-policy')).toBe('no-referrer');
    expect(result.headers.get('cache-control')).toBe('no-store');
    expect(await result.text()).toContain('method="post"');
    expect(upstream.mock.calls[0]?.[1]?.method).toBe('GET');
    expect(upstream.mock.calls[0]?.[0]).toBe(
      `https://example.supabase.co/functions/v1/mailing-email/confirm?token=${token}`,
    );
  });

  it('preserves POST for native forms and one-click unsubscribe', async () => {
    const upstream = vi
      .fn<typeof fetch>()
      .mockImplementation(() => Promise.resolve(new Response(html)));
    const base = await listen(upstream);
    for (const path of [
      `/email/unsubscribe?token=${token}`,
      `/api/mailing?action=confirm&token=${token}`,
    ]) {
      const result = await fetch(base + path, {
        method: 'POST',
        body: 'List-Unsubscribe=One-Click',
      });
      expect(result.status).toBe(200);
      expect(result.headers.get('content-type')).toContain('text/html');
    }
    expect(upstream.mock.calls.every((call) => call[1]?.method === 'POST')).toBe(true);
  });

  it('rejects invalid tokens, unknown actions, and unsupported methods without fetching', async () => {
    const upstream = vi.fn<typeof fetch>();
    const base = await listen(upstream);
    expect((await fetch(`${base}/email/confirm?token=invalid`)).status).toBe(400);
    expect((await fetch(`${base}/api/mailing?action=unknown&token=${token}`)).status).toBe(400);
    expect((await fetch(`${base}/email/confirm?token=${token}`, { method: 'DELETE' })).status).toBe(
      405,
    );
    expect(upstream).not.toHaveBeenCalled();
  });

  it('shows a safe error page when the upstream is unavailable', async () => {
    const upstream = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response('{"error":"private detail"}', { status: 503 }));
    const base = await listen(upstream);
    const result = await fetch(`${base}/email/confirm?token=${token}`);
    expect(result.status).toBe(503);
    expect(await result.text()).not.toContain('private detail');
  });

  it('routes both pages before the existing API catch-all', () => {
    const catchAll = vercel.rewrites.findIndex((route) => route.source === '/api/:path*');
    for (const action of ['confirm', 'unsubscribe']) {
      const index = vercel.rewrites.findIndex((route) => route.source === `/email/${action}`);
      expect(index).toBeGreaterThanOrEqual(0);
      expect(index).toBeLessThan(catchAll);
      expect(vercel.rewrites[index]?.destination).toBe(`/api/mailing?action=${action}`);
    }
  });
});
