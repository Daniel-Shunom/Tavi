// Screenshots each rig channel/node perturbation into contact sheets under test-results/motion-probe.
// Usage: start `npx vite --host 127.0.0.1 --port 5191`, then `node tools/motion-lab/probe.mjs`.
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

const base = process.env.TAVI_LAB_URL ?? 'http://127.0.0.1:5191';
const out = 'test-results/motion-probe';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 600, height: 600 }, deviceScaleFactor: 2 });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await page.goto(base + '/tools/motion-lab/probe.html');
await page.waitForFunction(() => document.body.dataset.ready || document.body.dataset.error);
const failure = await page.evaluate(() => document.body.dataset.error);
if (failure) throw new Error(failure);
const roles = await page.evaluate(() => window.probe.roles);
console.log('resolved node roles:', roles.join(', '));

const shots = [];
async function shot(label, state) {
  const base = process.env.BASE ? [{ name: process.env.BASE, time: 0, mix: 1 }] : [];
  await page.evaluate(
    (s) =>
      window.probe.set({ channels: {}, offsets: {}, ...s, clips: [...s.base, ...(s.clips ?? [])] }),
    { ...state, base },
  );
  const file = label.replace(/-/g, 'neg').replace(/[^a-z0-9.]+/gi, '_') + '.png';
  await page.screenshot({
    path: `${out}/${file}`,
    clip: { x: 100, y: 0, width: 400, height: 600 },
  });
  shots.push({ label, file });
}
const mode = process.argv[2] ?? 'channels';
await shot('rest', {});
if (mode === 'channels') {
  const channels = await page.evaluate(() => Object.keys(window.probeChannels ?? {}));
  for (const name of channels.length ? channels : JSON.parse(process.env.CHANNELS ?? '[]'))
    for (const value of [-1, 1])
      await shot(`${name} ${value}`, { channels: { [name]: { value, weight: 1 } } });
} else if (mode === 'nodes') {
  for (const role of roles) {
    await shot(`${role} rot`, { offsets: { [role]: { rotation: 0.5 } } });
    await shot(`${role} xy`, { offsets: { [role]: { x: 40, y: -40 } } });
  }
} else if (mode === 'custom') {
  for (const [label, state] of Object.entries(JSON.parse(process.env.CASES ?? '{}')))
    await shot(label, state);
} else if (mode === 'clips') {
  const clips = JSON.parse(process.env.CLIPS ?? '[]');
  for (const name of clips)
    for (const time of [0.25, 0.75, 1.25])
      await shot(`${name} ${time}`, { clips: [{ name, time, mix: 1 }] });
}
const sheet = `<body style="margin:0;display:grid;grid-template-columns:repeat(8,200px);background:#ccc;font:12px sans-serif">${shots
  .map(
    (s) =>
      `<figure style="margin:0"><img src="${s.file}" width="200"><figcaption>${s.label}</figcaption></figure>`,
  )
  .join('')}</body>`;
await writeFile(`${out}/sheet-${mode}.html`, sheet);
const sheetPage = await browser.newPage({ viewport: { width: 1600, height: 400 } });
await sheetPage.goto(
  'file:///' + process.cwd().replaceAll('\\', '/') + `/${out}/sheet-${mode}.html`,
);
await sheetPage.screenshot({ path: `${out}/sheet-${mode}.png`, fullPage: true });
console.log('errors:', errors.length ? errors : 'none');
await browser.close();
