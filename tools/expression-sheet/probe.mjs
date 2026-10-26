// Screenshots face channel values into a contact sheet under test-results/face-probe.
// Usage: serve the repo with Vite, then
//   TAVI_SHEET_URL=http://127.0.0.1:5173 node tools/expression-sheet/probe.mjs [cases.json]
// Without a cases file every face channel is shot at -1, -0.5, 0.5 and 1.
import { chromium } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

const base = process.env.TAVI_SHEET_URL ?? 'http://127.0.0.1:5173';
const out = 'test-results/face-probe';
await mkdir(out, { recursive: true });
const channels = [
  'gazeX',
  'gazeY',
  'browL',
  'browR',
  'squintL',
  'squintR',
  'blinkL',
  'blinkR',
  'smile',
  'mouthX',
  'mouthY',
  'squash',
];
const cases = process.argv[2]
  ? JSON.parse(await readFile(process.argv[2], 'utf8'))
  : Object.fromEntries(
      [['rest', {}]].concat(
        channels.flatMap((name) =>
          [-1, -0.5, 0.5, 1].map((value) => [`${name} ${value}`, { [name]: value }]),
        ),
      ),
    );
const browser = await chromium.launch({
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 600, height: 600 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await page.goto(base + '/tools/expression-sheet/probe.html');
await page.waitForFunction(() => document.body.dataset.ready || document.body.dataset.error);
const failure = await page.evaluate(() => document.body.dataset.error);
if (failure) throw new Error(failure);
const shots = [];
for (const [label, pose] of Object.entries(cases)) {
  await page.evaluate(
    ([p, z, f]) => window.probe.set(p, z, f),
    [pose, Number(process.env.ZOOM ?? 1.6), Number(process.env.FOCUS ?? 0.3)],
  );
  const file = label.replace(/-/g, 'm').replace(/[^a-z0-9.]+/gi, '_') + '.png';
  await page.screenshot({
    path: `${out}/${file}`,
    clip: JSON.parse(process.env.CLIP ?? '{"x":90,"y":0,"width":420,"height":470}'),
  });
  shots.push({ label, file });
}
const sheet = `<body style="margin:0;display:grid;grid-template-columns:repeat(6,240px);background:#ccc;font:13px sans-serif">${shots
  .map(
    (s) =>
      `<figure style="margin:0"><img src="${s.file}" width="240"><figcaption>${s.label}</figcaption></figure>`,
  )
  .join('')}</body>`;
const name = process.env.SHEET ?? 'channels';
await writeFile(`${out}/sheet-${name}.html`, sheet);
const sheetPage = await browser.newPage({ viewport: { width: 1440, height: 400 } });
await sheetPage.goto(
  'file:///' + process.cwd().replaceAll('\\', '/') + `/${out}/sheet-${name}.html`,
);
await sheetPage.screenshot({ path: `${out}/sheet-${name}.png`, fullPage: true });
console.log(`${String(shots.length)} shots -> ${out}/sheet-${name}.png`);
console.log('errors:', errors.length ? errors : 'none');
await browser.close();
