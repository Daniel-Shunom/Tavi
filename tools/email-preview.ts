import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { resolve } from 'node:path';
import { inviteVariants, renderEmail, renderInvite } from '../supabase/functions/_shared/templates';

const directory = resolve('.data/email-previews');
await mkdir(directory, { recursive: true });
const links = {
  siteUrl: 'https://example.invalid/tavi',
  unsubscribeUrl: 'https://example.invalid/unsubscribe-preview',
  postalAddress: 'Preview only · Sender mailing address will appear here',
  assetBaseUrl: 'http://127.0.0.1:4180',
};
const release = {
  id: 'design-preview',
  title: 'A little more life, coming soon.',
  body: 'This is a design preview of a Tavi release email. Your real release notes will appear here.\n\nA short introduction, a few things worth knowing, and a way to see what’s new. Just enough news to keep you in the loop.',
  url: 'https://example.invalid/tavi-release',
};
const pages = new Map<string, string>();
for (const kind of ['confirmation', 'welcome', 'release']) {
  const email = await renderEmail(kind, links, 'https://example.invalid/confirm-preview', release);
  pages.set(`/${kind}`, email.html);
  await writeFile(resolve(directory, `${kind}.html`), email.html);
  await writeFile(resolve(directory, `${kind}.txt`), email.text);
}
// Invitations: each wording, with example details filled in.
for (const variant of inviteVariants) {
  const email = await renderInvite(variant, links, { channel: 'ExampleChannel', from: 'Daniel' });
  pages.set(`/invite-${variant}`, email.html);
  await writeFile(resolve(directory, `invite-${variant}.html`), email.html);
  await writeFile(
    resolve(directory, `invite-${variant}.txt`),
    `Subject: ${email.subject}\n\n${email.text}`,
  );
}
const index =
  '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Tavi email previews</title><style>body{background:#f3eff6;color:#30203c;font:16px/1.6 system-ui;margin:48px auto;padding:24px;max-width:680px}h1{font:48px Georgia}a{display:block;margin:16px 0;padding:20px;background:white;border-radius:12px;color:inherit;text-decoration:none}a:hover{outline:2px solid #b9a5db}</style><h1>A little news from Tavi.</h1><p>Email design previews. Nothing is sent from this page.</p><a href="/confirmation">Confirmation email</a><a href="/welcome">Welcome email</a><a href="/release">Release newsletter · example content</a>' +
  inviteVariants
    .map((variant) => `<a href="/invite-${variant}">Invitation · ${variant}</a>`)
    .join('') +
  '</html>';
await writeFile(resolve(directory, 'index.html'), index);
console.log(`Rendered ${pages.size} email previews in ${directory}`);
if (process.argv.includes('--serve')) {
  createServer((req, res) => {
    const asset = req.url?.match(
      /^\/media\/email\/(tavi-(?:wordmark|wave|happy|cheer|hmm|smug|hype|lol|ooh)\.png)$/,
    )?.[1];
    if (asset) {
      res.setHeader('Content-Type', 'image/png');
      void readFile(resolve('public/media/email', asset))
        .then((data) => res.end(data))
        .catch(() => {
          res.statusCode = 404;
          res.end();
        });
      return;
    }
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    const kind = req.url?.slice(1);
    const name = req.url === '/' ? 'index' : kind && pages.has(`/${kind}`) ? kind : null;
    if (!name) {
      res.statusCode = 404;
      res.end('Preview not found');
      return;
    }
    void readFile(resolve(directory, `${name}.html`))
      .then((data) => res.end(data))
      .catch(() => {
        res.statusCode = 404;
        res.end('Preview not found');
      });
  }).listen(4180, '127.0.0.1', () => console.log('Email designs: http://127.0.0.1:4180'));
}
