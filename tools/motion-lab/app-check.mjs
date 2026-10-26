// Read-only check of the real studio and overlay with the motion layer: loads, idles for a few
// seconds, captures a frame strip, reports console errors and frame-time stats. Sends no commands.
// Usage: vite on TAVI_LAB_URL (default http://127.0.0.1:5191) with the service on 4318.
import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const base = process.env.TAVI_LAB_URL ?? 'http://127.0.0.1:5191';
const out = 'test-results/motion-app';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
for (const [name, path, viewport] of [
  ['overlay', '/overlay', { width: 1280, height: 720 }],
  ['studio', '/', { width: 1400, height: 900 }],
]) {
  const page = await browser.newPage({ viewport });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto(base + path);
  await page.waitForSelector('[data-ready="true"]', { timeout: 20000 });
  const stats = await page.evaluate(
    () =>
      new Promise((resolve) => {
        const times = [];
        let last = performance.now();
        const tick = (now) => {
          times.push(now - last);
          last = now;
          if (times.length < 240) requestAnimationFrame(tick);
          else {
            times.sort((a, b) => a - b);
            resolve({ median: times[120], p95: times[228], max: times[239] });
          }
        };
        requestAnimationFrame(tick);
      }),
  );
  for (let i = 0; i < 4; i++) {
    await page.screenshot({ path: `${out}/${name}-${i}.png` });
    await page.waitForTimeout(700);
  }
  const data = await page.evaluate(() => {
    const el = document.querySelector('[data-renderer]');
    return el ? { ...el.dataset } : null;
  });
  console.log(name, JSON.stringify({ stats, data, errors }));
  await page.close();
}
await browser.close();
