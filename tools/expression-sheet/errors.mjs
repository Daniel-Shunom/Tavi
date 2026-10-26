// Prints page errors with stacks for the expression sheet (debugging aid).
// Usage: TAVI_SHEET_URL=http://127.0.0.1:5173 node tools/expression-sheet/errors.mjs
import { chromium } from '@playwright/test';

const base = process.env.TAVI_SHEET_URL ?? 'http://127.0.0.1:5173';
const browser = await chromium.launch({
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage();
page.on('console', (m) => {
  if (m.type() === 'error') console.log(m.text());
});
page.on('pageerror', (e) => console.log('pageerror', e.stack));
await page.goto(base + '/tools/expression-sheet/?paused');
await page.waitForFunction(() => document.body.dataset.ready || document.body.dataset.error, null, {
  timeout: 120000,
});
if (process.env.SEEK)
  console.log(
    await page.evaluate((args) => {
      window.sheet.seek(...args);
      return JSON.stringify(window.sheet.pose());
    }, JSON.parse(process.env.SEEK)),
  );
console.log('status:', await page.evaluate(() => document.body.dataset.error ?? 'ready'));
await browser.close();
