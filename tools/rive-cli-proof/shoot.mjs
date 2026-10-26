// Screenshots the Rive CLI proof face through the app's renderer into test-results/rive-cli-proof.
// Usage: serve the repo with Vite, then
//   TAVI_SHEET_URL=http://127.0.0.1:5173 node tools/rive-cli-proof/shoot.mjs
import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const base = process.env.TAVI_SHEET_URL ?? 'http://127.0.0.1:5173';
const out = 'test-results/rive-cli-proof';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 300, height: 300 } });
await page.goto(base + '/tools/rive-cli-proof/index.html');
await page.waitForFunction(() => document.body.dataset.ready || document.body.dataset.error);
const failure = await page.evaluate(() => document.body.dataset.error);
if (failure) throw new Error(failure);
const cases = {
  rest: [],
  'brows-raised': [{ track: 'brows', time: 0, mix: 1 }],
  'brows-furrowed': [{ track: 'brows', time: 1, mix: 1 }],
  smile: [{ track: 'mouth-curve', time: 1, mix: 1 }],
  frown: [{ track: 'mouth-curve', time: 0, mix: 1 }],
  'blink-half': [{ track: 'blink', time: 0.5, mix: 1 }],
  'oops-early': [{ track: 'oops', time: 0.08, mix: 1 }],
  'oops-held': [{ track: 'oops', time: 1, mix: 1 }],
};
for (const [label, tracks] of Object.entries(cases)) {
  await page.evaluate((t) => window.proof.show(t), tracks);
  await page.screenshot({ path: `${out}/${label}.png` });
}
console.log(`${String(Object.keys(cases).length)} shots -> ${out}`);
await browser.close();
