// Screenshots rig test cases of a .riv into test-results/mascot-remix/<sheet>.png.
// Usage: TAVI_SHEET_URL=http://127.0.0.1:5173 node tools/mascot-remix/shoot.mjs cases.json
//   cases.json: { "label": { "clips": [{ "name": "...", "time": 0 }], "offsets": { "role": {...} } } }
// Env: FILE (riv url), BONES (comma list name[:kind]), SHEET (output name).
import { chromium } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

const base = process.env.TAVI_SHEET_URL ?? 'http://127.0.0.1:5173';
const out = 'test-results/mascot-remix';
await mkdir(out, { recursive: true });
const cases = process.argv[2] ? JSON.parse(await readFile(process.argv[2], 'utf8')) : { rest: {} };
const query = new URLSearchParams();
if (process.env.FILE) query.set('file', process.env.FILE);
if (process.env.BONES) query.set('bones', process.env.BONES);
const browser = await chromium.launch({
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 600, height: 600 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await page.goto(`${base}/tools/mascot-remix/view.html?${query.toString()}`);
await page.waitForFunction(() => document.body.dataset.ready || document.body.dataset.error, null, {
  timeout: 120000,
});
const failure = await page.evaluate(() => document.body.dataset.error);
if (failure) throw new Error(failure);
console.log('roles resolved:', await page.evaluate(() => window.view.roles.join(', ')));
const shots = [];
for (const [label, state] of Object.entries(cases)) {
  await page.evaluate((s) => window.view.set(s), state);
  const file = label.replace(/[^a-z0-9.-]+/gi, '_') + '.png';
  await page.screenshot({
    path: `${out}/${file}`,
    clip: { x: 100, y: 0, width: 400, height: 600 },
  });
  shots.push({ label, file });
}
const name = process.env.SHEET ?? 'sheet';
await writeFile(
  `${out}/${name}.html`,
  `<body style="margin:0;display:grid;grid-template-columns:repeat(6,200px);background:#ccc;font:12px sans-serif">${shots
    .map(
      (s) =>
        `<figure style="margin:0"><img src="${s.file}" width="200"><figcaption>${s.label}</figcaption></figure>`,
    )
    .join('')}</body>`,
);
const sheet = await browser.newPage({ viewport: { width: 1200, height: 300 } });
await sheet.goto('file:///' + process.cwd().replaceAll('\\', '/') + `/${out}/${name}.html`);
await sheet.screenshot({ path: `${out}/${name}.png`, fullPage: true });
console.log(`${String(shots.length)} shots -> ${out}/${name}.png`);
console.log('errors:', errors.length ? errors : 'none');
await browser.close();
