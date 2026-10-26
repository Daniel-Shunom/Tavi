// Prints the measure page's result (Vite serving the repo).
// Usage: TAVI_TEST_URL=http://127.0.0.1:5173 node tools/variants/read-measure.mjs
import { chromium } from '@playwright/test';

const base = process.env.TAVI_TEST_URL ?? 'http://127.0.0.1:5173';
const browser = await chromium.launch({
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage();
await page.goto(base + '/tools/variants/measure.html');
await page.waitForFunction(() => document.body.dataset.ready || document.body.dataset.error, null, {
  timeout: 120000,
});
console.log(await page.evaluate(() => document.body.dataset.error ?? document.body.dataset.result));
await browser.close();
