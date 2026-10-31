// Clicks a studio dock button and captures the portrait every 250 ms into
// test-results/studio-strip/<label>-<n>.png, to check acting in the real app.
// Usage: TAVI_TEST_URL=http://127.0.0.1:5173 node tools/expression-sheet/studio-strip.mjs oops
import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const base = process.env.TAVI_TEST_URL ?? 'http://127.0.0.1:5173';
const label = process.argv[2] ?? 'oops';
const out = 'test-results/studio-strip';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({
  args: process.env.GPU ? ['--enable-gpu', '--use-angle=d3d11'] : ['--use-angle=swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
page.on('pageerror', (e) => console.log('pageerror', e.message));
await page.goto(base + '/studio');
// A fresh browser meets the Twitch sign-in screen first.
await page.getByRole('button', { name: 'Skip for now' }).click();
await page.locator('.st-screen .avatar-renderer[data-ready="true"]').waitFor({ timeout: 30000 });
await page.waitForTimeout(1500);
const fps = await page.evaluate(
  () =>
    new Promise((resolve) => {
      let frames = 0;
      const start = performance.now();
      const tick = () => {
        frames++;
        if (performance.now() - start < 1000) requestAnimationFrame(tick);
        else resolve(frames);
      };
      requestAnimationFrame(tick);
    }),
);
console.log('fps', fps);
await page
  .getByRole('group', { name: 'Reactions' })
  .getByRole('button', { name: label, exact: true })
  .click();
for (let i = 0; i < 12; i++) {
  await page.waitForTimeout(250);
  const performance = await page
    .locator('.st-screen .avatar-renderer')
    .getAttribute('data-performance');
  await page
    .locator('.st-screen')
    .screenshot({ path: `${out}/${label.replace('?', '')}-${String(i).padStart(2, '0')}.png` });
  console.log(i, performance);
}
await browser.close();
