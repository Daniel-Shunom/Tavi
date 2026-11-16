import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { z } from 'zod';
import { renderEmail } from '../supabase/functions/_shared/templates';

const path = process.argv[2];
if (!path || path.startsWith('-'))
  throw new Error('Usage: npm run email:release -- release.json [--send]');
const release = z
  .object({
    id: z.string().regex(/^[a-zA-Z0-9._-]{1,80}$/),
    title: z.string().min(1).max(160),
    body: z.string().min(1).max(8000),
    url: z.url().refine((value) => new URL(value).protocol === 'https:'),
  })
  .parse(JSON.parse(await readFile(resolve(path), 'utf8')) as unknown);

const links = {
  siteUrl: process.env['TAVI_PUBLIC_URL'] ?? 'https://example.invalid/tavi',
  unsubscribeUrl: 'https://example.invalid/unsubscribe-preview',
  postalAddress:
    process.env['TAVI_POSTAL_ADDRESS'] ?? 'Preview only · Sender mailing address will appear here',
};
const email = await renderEmail('release', links, '', release);
const directory = resolve('.data/email-previews');
await mkdir(directory, { recursive: true });
const preview = resolve(directory, `release-${release.id}.html`);
await writeFile(preview, email.html);
await writeFile(resolve(directory, `release-${release.id}.txt`), email.text);
console.log(`Release preview: ${preview}`);
if (!process.argv.includes('--send')) {
  console.log('Nothing queued. Review the preview, then rerun with --send to queue this release.');
} else {
  const url = process.env['SUPABASE_URL'];
  const key = process.env['SUPABASE_SERVICE_ROLE_KEY'];
  if (!url || !key || new URL(url).protocol !== 'https:') {
    throw new Error(
      'Set server-only SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before queueing a release.',
    );
  }
  const headers: Record<string, string> = { apikey: key, 'Content-Type': 'application/json' };
  if (!key.startsWith('sb_secret_')) headers['Authorization'] = `Bearer ${key}`;
  const response = await fetch(`${new URL(url).origin}/rest/v1/rpc/mailing_queue_release`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ release_content: release }),
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok)
    throw new Error(`Release queue request failed (HTTP ${String(response.status)}).`);
  const queued: unknown = await response.json();
  if (typeof queued !== 'number') throw new Error('Unexpected release queue response.');
  console.log(
    `Queued ${String(queued)} email(s) for confirmed subscribers. Reusing the same release ID does not resend it.`,
  );
}
