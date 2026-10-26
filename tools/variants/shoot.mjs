// Screenshots the variant contact sheet into test-results/variants/sheet/<row>.png (one image per
// preset, hairstyle, covering and ramp row) and reports page errors.
// Usage (Vite serving the repo): TAVI_TEST_URL=http://127.0.0.1:5173 node tools/variants/shoot.mjs [presets|hair|ramp] [row-id...]
import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const base = process.env.TAVI_TEST_URL ?? 'http://127.0.0.1:5173';
const [only, ...rows] = process.argv.slice(2);
const out = 'test-results/variants/sheet';
const browser = await chromium.launch({
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({
  viewport: { width: 2200, height: 1200 },
  deviceScaleFactor: 1,
});
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await page.goto(`${base}/tools/variants/sheet.html${only ? `?only=${only}` : ''}`);
await page.waitForFunction(() => document.body.dataset.ready || document.body.dataset.error, null, {
  timeout: 600000,
});
const failure = await page.evaluate(() => document.body.dataset.error);
if (failure) console.log('ERROR', failure);
await mkdir(out, { recursive: true });
const ids = await page.evaluate(() =>
  [...document.querySelectorAll('[data-row]')].map((e) => e.dataset.row),
);
for (const id of ids) {
  if (rows.length && !rows.includes(id)) continue;
  await page.locator(`[data-row="${id}"]`).screenshot({ path: `${out}/${id}.png` });
}
console.log(`${ids.length} rows -> ${out}`);
const relevant = errors.filter((e) => !e.includes('Blank Script'));
console.log('errors:', relevant.length ? relevant : 'none');
await browser.close();
