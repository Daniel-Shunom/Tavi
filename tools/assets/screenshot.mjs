// Captures attachment preview screenshots into test-results/assets/ (ignored by git).
// Start Vite first, e.g. `npx vite --host 127.0.0.1 --port 5297`, then:
//   node tools/assets/screenshot.mjs [--base http://127.0.0.1:5297] [--only id,id]
// One thumbnail per item (alone on the character), plus outfit combos in several poses.
import { chromium } from '@playwright/test';
import { mkdir, readFile, readdir } from 'node:fs/promises';

const args = process.argv.slice(2);
const flag = (name) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};
const base = flag('--base') ?? process.env.TAVI_ASSET_URL ?? 'http://127.0.0.1:5297';
const only = flag('--only')?.split(',');
const out = 'test-results/assets';
await mkdir(out, { recursive: true });

const items = [];
for (const file of await readdir('assets/items'))
  if (file.endsWith('.json'))
    items.push(JSON.parse(await readFile('assets/items/' + file, 'utf8')));

const shots = [];
for (const item of items)
  if (!only || only.includes(item.id))
    shots.push({ name: item.id, equip: `${item.slot}:${item.id}`, clip: 'back and forth', t: 0.3 });
const outfits = (flag('--outfits') ?? '').split(';').filter(Boolean);
outfits.forEach((equip, index) => {
  for (const [clip, t] of [
    ['back and forth', 0.3],
    ['wave', 0.9],
    ['celebration', 0.8],
    ['hands on hips', 1.6],
  ])
    shots.push({ name: `outfit${index}-${clip.replaceAll(' ', '-')}`, equip, clip, t });
});
// --raw "name=query&string;name2=..." captures arbitrary preview states (e.g. debug=1).
for (const entry of (flag('--raw') ?? '').split(';').filter(Boolean)) {
  const [name, query] = entry.split('=', 2);
  shots.push({ name, query: entry.slice(name.length + 1) || query });
}

const browser = await chromium.launch({ headless: true });
const errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 360, height: 400 } });
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (process.env.DEBUG) console.log(message.type(), message.text());
    if (message.type() === 'error' && !message.text().startsWith('Blank Script'))
      errors.push(message.text());
  });
  for (const shot of shots) {
    const url = shot.query
      ? `${base}/tools/assets/preview.html?shot&${shot.query}`
      : `${base}/tools/assets/preview.html?shot&equip=${encodeURIComponent(shot.equip)}&clip=${encodeURIComponent(shot.clip)}&t=${String(shot.t)}`;
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('body[data-ready="true"]', { timeout: 15000 });
    await page.locator('#stage').screenshot({ path: `${out}/${shot.name}.png` });
  }
} finally {
  await browser.close();
}
if (errors.length) {
  console.error(errors.join('\n'));
  process.exitCode = 1;
}
console.log(`Captured ${String(shots.length)} screenshots in ${out}/`);
