// Captures every key pose of pose-lab sources at overlay size (1:1 on a 1280 x 720 stage, the
// size OBS shows) and large, plus a motion strip (every 0.1 s), into
// test-results/pose-lab/<character>/<source>-{keys-overlay,keys-large,strip}.png and a
// report.json with the rubric findings. Usage: Vite serving the repo (TAVI_LAB_URL, default
// http://127.0.0.1:5173), then
//   node tools/pose-lab/shoot.mjs [--character mascot-v2] [--strip] [source ids...]
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const i = args.indexOf(name);
  if (i < 0) return fallback;
  const value = args[i + 1];
  args.splice(i, 2);
  return value;
};
const flag = (name) => {
  const i = args.indexOf(name);
  if (i < 0) return false;
  args.splice(i, 1);
  return true;
};
const base = process.env.TAVI_LAB_URL ?? 'http://127.0.0.1:5173';
const character = option('--character', 'mascot-v2');
const strip = flag('--strip');
const out = `test-results/pose-lab/${character}`;
await mkdir(out, { recursive: true });
const browser = await chromium.launch({
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
// Stage at exactly 1:1: the stage area is 1280 x 720 CSS px (the side panel is 340 px).
const page = await browser.newPage({ viewport: { width: 1280 + 340, height: 720 + 90 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await page.goto(`${base}/tools/pose-lab/?character=${character}`);
await page.waitForFunction(() => document.body.dataset.ready || document.body.dataset.error, null, {
  timeout: 180000,
});
const failure = await page.evaluate(() => document.body.dataset.error);
if (failure) throw new Error(failure);
const all = await page.evaluate(() => window.poseLab.sources());
const ids = args.length ? args : all.map((s) => s.id);
const report = {};

async function sheet(name, shots, columns) {
  const html = `<body style="margin:0;display:grid;grid-template-columns:repeat(${columns},auto);gap:2px;background:#fff;font:12px sans-serif;width:max-content">${shots
    .map(
      (s) =>
        `<figure style="margin:0"><img src="data:image/png;base64,${s.png}" style="display:block"><figcaption style="padding:2px 4px">${s.label}</figcaption></figure>`,
    )
    .join('')}</body>`;
  const p = await browser.newPage({ viewport: { width: 800, height: 400 } });
  await p.setContent(html);
  await p.screenshot({ path: `${out}/${name}.png`, fullPage: true });
  await p.close();
}

for (const id of ids) {
  const source = all.find((s) => s.id === id);
  if (!source) {
    console.log('unknown source', id);
    continue;
  }
  const info = await page.evaluate(
    (beat) => window.poseLab.set({ beat, view: 'overlay', onion: false, overlays: false, t: 0 }),
    id,
  );
  const stage = await page.locator('#stage').boundingBox();
  const k = stage.width / 1280;
  // Crop around the beat origin: 0.95 BH each side, 1.5 BH above, 0.35 below (overlay pixels).
  const BH = 176;
  const above = info.frame === 'ledge' ? 1.1 : 1.45;
  const crop = {
    x: stage.x + (info.origin.x - 0.95 * BH) * k,
    y: stage.y + Math.max(0, info.origin.y - above * BH) * k,
    width: 1.9 * BH * k,
    height: (above + 0.4) * BH * k,
  };
  const keyShots = [];
  for (const key of info.keys) {
    await page.evaluate((t) => window.poseLab.set({ t }), key.at);
    keyShots.push({
      label: key.name,
      png: (await page.screenshot({ clip: crop })).toString('base64'),
    });
  }
  await sheet(`${id}-keys-overlay`, keyShots, Math.min(8, keyShots.length));
  // Large: the lab's zoomed view with the proxy overlays.
  await page.evaluate(() => window.poseLab.set({ view: 'large', overlays: true }));
  const large = [];
  const wrap = await page.locator('#stageWrap').boundingBox();
  for (const key of info.keys) {
    await page.evaluate((t) => window.poseLab.set({ t }), key.at);
    large.push({
      label: key.name,
      png: (
        await page.screenshot({
          clip: {
            x: wrap.x + wrap.width * 0.2,
            y: wrap.y,
            width: wrap.width * 0.6,
            height: wrap.height,
          },
        })
      ).toString('base64'),
    });
  }
  await sheet(`${id}-keys-large`, large, Math.min(5, large.length));
  if (strip) {
    await page.evaluate(() => window.poseLab.set({ view: 'overlay', overlays: false }));
    const frames = [];
    for (let t = 0; t <= info.duration + 1e-6; t += 0.1) {
      await page.evaluate((time) => window.poseLab.set({ t: time }), t);
      frames.push({
        label: t.toFixed(1),
        png: (await page.screenshot({ clip: crop })).toString('base64'),
      });
    }
    await sheet(`${id}-strip`, frames, 10);
  }
  report[id] = await page.evaluate(() => window.poseLab.findings());
  console.log(id, `${info.keys.length} keys`, `${report[id].length} findings`);
}
report.errors = errors;
await writeFile(`${out}/report.json`, JSON.stringify(report, null, 1));
console.log('errors:', errors.length ? errors : 'none');
await browser.close();
