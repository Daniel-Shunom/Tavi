// Screenshots the expression sheet into test-results/expression-sheet/:
//   sheet-<intensity>.png         the whole grid (subtle, typical, strong)
//   cards/<intensity>/<id>.png    each pose card
//   transitions/<a>-<b>-<t>.png   transition player frames
// Usage: serve the repo with Vite, then
//   TAVI_SHEET_URL=http://127.0.0.1:5173 node tools/expression-sheet/shoot.mjs [ids...]
import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const base = process.env.TAVI_SHEET_URL ?? 'http://127.0.0.1:5173';
const out = 'test-results/expression-sheet';
const only = process.argv.slice(2);
const browser = await chromium.launch({
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({
  viewport: { width: 1320, height: 900 },
  deviceScaleFactor: 2,
});
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await page.goto(base + '/tools/expression-sheet/?paused');
await page.waitForFunction(() => document.body.dataset.ready || document.body.dataset.error, null, {
  timeout: 120000,
});
const failure = await page.evaluate(() => document.body.dataset.error);
if (failure) throw new Error(failure);
const ids = await page.evaluate(() => window.sheet.ids);
for (const intensity of process.env.INTENSITIES?.split(',').map(Number) ?? [0.25, 0.6, 1]) {
  await page.evaluate((value) => window.sheet.setIntensity(value), intensity);
  await mkdir(`${out}/cards/${intensity}`, { recursive: true });
  if (!only.length)
    await page.locator('#grid').screenshot({ path: `${out}/sheet-${intensity}.png` });
  for (const id of only.length ? only : ids)
    await page
      .locator(`[data-expression="${id}"]`)
      .screenshot({ path: `${out}/cards/${intensity}/${id}.png` });
}
await mkdir(`${out}/transitions`, { recursive: true });
const pairs = (
  process.env.PAIRS ?? 'content:innocent,innocent:embarrassed,skeptical:laugh,sad:grin'
)
  .split(',')
  .map((pair) => pair.split(':'));
for (const [a, b] of pairs)
  for (const t of [1, 1.85, 1.95, 2.1, 2.6, 3.4]) {
    await page.evaluate(([s, x, y]) => window.sheet.seek(s, x, y), [t, a, b]);
    await page
      .locator('.player')
      .screenshot({ path: `${out}/transitions/${a}-${b}-${t.toFixed(2)}.png` });
  }
console.log(`${ids.length} poses -> ${out}`);
console.log('errors:', errors.length ? errors : 'none');
await browser.close();
