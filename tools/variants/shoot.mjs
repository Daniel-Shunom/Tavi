// Screenshots the variant contact sheet into test-results/variants/sheet/<row>.png (one image per
// preset, hairstyle, covering and ramp row) and reports page errors.
// Usage (Vite serving the repo): TAVI_TEST_URL=http://127.0.0.1:5173 node tools/variants/shoot.mjs [presets|hair|ramp] [row-id...]
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

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
await page.goto(`${base}/tools/variants/sheet.html${only ? `?only=${only}` : ''}`, {
  waitUntil: 'domcontentloaded',
});
await page.waitForFunction(() => document.body.dataset.ready || document.body.dataset.error, null, {
  timeout: 120000,
});
const failure = await page.evaluate(() => document.body.dataset.error);
if (failure) throw new Error(failure);
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
if (only === 'turns' || only === 'fitting' || only === 'travel') {
  const metrics = await page.evaluate(() =>
    [...document.querySelectorAll('[data-row]')].map((row) => ({
      id: row.dataset.row,
      frames: [...row.querySelectorAll('canvas')].map((canvas) => ({
        turnHead: Number(canvas.dataset.turnHead),
        turnBody: Number(canvas.dataset.turnBody),
        faceX: Number(canvas.dataset.faceX),
        gazeX: Number(canvas.dataset.gazeX),
      })),
    })),
  );
  await writeFile(`${out}/${only}-metrics.json`, JSON.stringify(metrics, null, 2));
  for (const row of metrics) {
    if (only === 'travel') {
      const direction = row.id.endsWith('-left') ? -1 : 1;
      for (const frame of row.frames.slice(1, 3)) {
        if (
          frame.turnHead * direction < 0.3 ||
          frame.turnBody * direction < 0.1 ||
          frame.gazeX * direction <= 0
        )
          throw new Error(`${row.id}: eyes/head/body do not face the travel target`);
      }
      const final = row.frames.at(-1);
      if (Math.abs(final.turnHead) > 0.05 || Math.abs(final.turnBody) > 0.05)
        throw new Error(`${row.id}: turn did not settle after arrival`);
      continue;
    }
    const values = row.frames.map((frame) => frame.turnHead);
    if (JSON.stringify(values) !== JSON.stringify([-1, -0.6, 0, 0.6, 1]))
      throw new Error(`${row.id}: incomplete turn coverage`);
    if (row.frames[4].faceX - row.frames[0].faceX < 10)
      throw new Error(`${row.id}: turn did not move the face plane`);
  }
  console.log(
    `${metrics.length} directional rows: ${only === 'travel' ? 'target gaze, head/body direction and arrival verified' : 'bound inputs and runtime face displacement verified'}`,
  );
}
await browser.close();
if (relevant.length) throw new Error('Browser errors in contact sheet');
