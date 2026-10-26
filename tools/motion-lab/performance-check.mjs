// Captures frame sequences of the skeptical / caught / approve (nod) performances in the motion lab
// and checks that consecutive frames during the hold actually differ (no frozen poses).
// Usage: vite on TAVI_LAB_URL (default http://127.0.0.1:5191), then node tools/motion-lab/performance-check.mjs
import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const base = process.env.TAVI_LAB_URL ?? 'http://127.0.0.1:5191';
const out = 'test-results/motion-performances';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 1400, height: 700 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(base + '/tools/motion-lab/');
await page.waitForFunction(() => document.body.dataset.ready);
const after = page.locator('#after');
const box = await after.boundingBox();
// Crop around the character (centre of the stage).
const clip = {
  x: box.x + box.width * 0.36,
  y: box.y + box.height * 0.3,
  width: box.width * 0.28,
  height: box.height * 0.65,
};
const results = {};
for (const id of ['skeptical', 'caught', 'approve']) {
  await page.waitForTimeout(3500); // let the previous performance finish
  await page.evaluate((name) => window.lab.express(name), id);
  const frames = [];
  for (let i = 0; i < 24; i++) {
    const buffer = await page.screenshot({
      clip,
      path: `${out}/${id}-${String(i).padStart(2, '0')}.png`,
    });
    frames.push(buffer);
    await page.waitForTimeout(90);
  }
  // Hold window: frames 8-20 (~0.8-2.0 s after the cue).
  let identical = 0;
  for (let i = 9; i <= 20; i++) if (Buffer.compare(frames[i], frames[i - 1]) === 0) identical++;
  results[id] = { holdPairsCompared: 12, identicalPairs: identical };
}
console.log(JSON.stringify({ results, errors }));
await browser.close();
