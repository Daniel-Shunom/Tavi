// High-resolution product screenshots for the media gallery: Studio's four rooms, the landing
// page, and the transparent OBS overlay. Serve the built app first (repo root):
//   npm run build && TAVI_PORT=4335 npx tsx server/index.ts
// then, from video/: node capture/screenshots.mjs http://127.0.0.1:4335
// Writes 3840x2160 PNGs (1920x1080 at 2x) to ../brand/screenshots/.
import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const base = process.argv[2] ?? 'http://127.0.0.1:4335';
const out = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', 'brand', 'screenshots');
await mkdir(out, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 2, colorScheme: 'dark' });
const page = await context.newPage();
const shot = async (name, options = {}) => {
  await page.screenshot({ path: join(out, `${name}.png`), ...options });
  console.log('wrote', name);
};
const room = async (name) => {
  const label = new RegExp(`^${name}\\b`);
  await page.getByRole('link', { name: label }).or(page.getByRole('button', { name: label })).first().click();
  await page.waitForTimeout(2500);
};

await page.goto(`${base}/`);
await page.waitForTimeout(7000);
await shot('01-landing');

await page.goto(`${base}/studio`);
await page.waitForTimeout(5000);
await page.getByRole('button', { name: /Celebrate/ }).first().click().catch(() => {});
await page.waitForTimeout(900);
await shot('02-studio-live');

await room('Look');
await shot('03-studio-look');
await room('Personality');
await shot('04-studio-personality');
await room('Setup');
// The capture server runs on a spare port; show the links as a streamer sees them (default 4318).
const port = new URL(base).port;
await page.evaluate((port) => {
  for (const input of document.querySelectorAll('input')) input.value = input.value.replace(`:${port}/`, ':4318/');
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) walker.currentNode.nodeValue = walker.currentNode.nodeValue.replace(`:${port}/`, ':4318/');
}, port);
await shot('05-studio-setup');

// The overlay exactly as OBS receives it: the character on a transparent canvas.
const overlay = await context.newPage();
await overlay.goto(`${base}/overlay`);
await overlay.waitForTimeout(6000);
await overlay.screenshot({ path: join(out, '06-overlay-transparent.png'), omitBackground: true });
console.log('wrote 06-overlay-transparent');

await browser.close();
