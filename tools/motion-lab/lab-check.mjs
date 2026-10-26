// Drives the motion lab and saves frame strips to test-results/motion-lab/.
// Usage: vite on TAVI_LAB_URL (default http://127.0.0.1:5191), then node tools/motion-lab/lab-check.mjs
import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const base = process.env.TAVI_LAB_URL ?? 'http://127.0.0.1:5191';
const out = 'test-results/motion-lab';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 1400, height: 700 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await page.goto(base + '/tools/motion-lab/');
await page.waitForFunction(() => document.body.dataset.ready || document.body.dataset.error);
const failure = await page.evaluate(() => document.body.dataset.error);
if (failure) throw new Error(failure);
const after = page.locator('#after');
async function strip(name, count, gap) {
  for (let i = 0; i < count; i++) {
    await after.screenshot({ path: `${out}/${name}-${String(i).padStart(2, '0')}.png` });
    await page.waitForTimeout(gap);
  }
}
await page.waitForTimeout(500);
await strip('idle', 6, 400);
await page.evaluate(() => window.lab.moveTo(0.85));
await strip('walk', 10, 250);
await page.evaluate(() => window.lab.settings({ personality: 'playful' }));
await page.evaluate(() => window.lab.moveTo(0.15));
await strip('hop', 10, 200);
await page.evaluate(() => window.lab.express('skeptical'));
await strip('skeptical', 6, 300);
await page.evaluate(() => window.lab.hide('hopOff'));
await strip('hopoff', 6, 120);
await page.evaluate(() => window.lab.show('drop'));
await strip('drop', 12, 120);
await page.screenshot({ path: `${out}/page.png` });
const times = await page.evaluate(() => window.lab.frameTimes());
times.sort((a, b) => a - b);
console.log(
  JSON.stringify({
    errors,
    motionAndDrawMs: {
      median: times[Math.floor(times.length / 2)],
      p95: times[Math.floor(times.length * 0.95)],
    },
  }),
);
await browser.close();
