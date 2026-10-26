// Screenshots a page of the variant tools to test-results/variants/<name>.png.
// Usage (Vite serving the repo): node tools/variants/shot.mjs <name> "<path?query>" [selector]
import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const base = process.env.TAVI_TEST_URL ?? 'http://127.0.0.1:5173';
const [name = 'shot', path = '/tools/variants/probe.html', selector = 'body'] =
  process.argv.slice(2);
const browser = await chromium.launch({
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({
  viewport: { width: Number(process.env.W ?? 660), height: Number(process.env.H ?? 660) },
  deviceScaleFactor: Number(process.env.DPR ?? 1),
});
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await page.goto(base + '/' + path.replace(/^\/+/, ''));
await page.waitForFunction(() => document.body.dataset.ready || document.body.dataset.error, null, {
  timeout: 120000,
});
const failure = await page.evaluate(() => document.body.dataset.error);
await mkdir('test-results/variants', { recursive: true });
await page
  .locator(selector)
  .first()
  .screenshot({ path: `test-results/variants/${name}.png` });
console.log(`test-results/variants/${name}.png`, failure ? 'ERROR ' + failure : '');
const relevant = errors.filter((e) => !e.includes('Blank Script'));
if (relevant.length) console.log('errors:', relevant);
await browser.close();
