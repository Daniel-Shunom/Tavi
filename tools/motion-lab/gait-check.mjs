// Frame sequences of gaits in the motion lab (deterministic stepping), as contact sheets in
// test-results/motion-gaits/<gait>-<character>.png.
// Usage: one vite server on TAVI_LAB_URL (default http://127.0.0.1:5191), then
//   node tools/motion-lab/gait-check.mjs [gait ...]
import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const base = process.env.TAVI_LAB_URL ?? 'http://127.0.0.1:5191';
const out = 'test-results/motion-gaits';
await mkdir(out, { recursive: true });
const gaits = process.argv.slice(2).length ? process.argv.slice(2) : ['skip', 'trudge'];
const browser = await chromium.launch({
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const summary = {};
for (const character of ['v1', 'v2']) {
  const page = await browser.newPage({ viewport: { width: 2000, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(base + '/tools/motion-lab/' + (character === 'v2' ? '?character=v2' : ''));
  await page.waitForFunction(() => document.body.dataset.ready);
  const stage = await page.locator('#after').boundingBox();
  const clip = {
    x: stage.x,
    y: stage.y + stage.height * 0.35,
    width: stage.width,
    height: stage.height * 0.65,
  };
  for (const gait of gaits) {
    await page.evaluate(() => window.lab.pause());
    await page.evaluate(() => window.lab.walk(0.15, 'walk'));
    await page.evaluate(() => window.lab.advance(14));
    await page.evaluate((g) => window.lab.walk(0.85, g), gait);
    const shots = [];
    for (let t = 0; t < 7.2; t += 0.15) {
      shots.push((await page.screenshot({ clip })).toString('base64'));
      await page.evaluate(() => window.lab.advance(0.15));
    }
    await page.evaluate(() => window.lab.resume());
    summary[`${gait}-${character}`] = {
      frames: shots.length,
      distinct: new Set(shots).size,
      errors: errors.length,
    };
    const html = `<body style="margin:0;display:grid;grid-template-columns:repeat(6,1fr);background:#fff">${shots
      .map(
        (s, i) =>
          `<div style="position:relative"><img src="data:image/png;base64,${s}" style="width:100%"><span style="position:absolute;left:2px;top:0;font:10px sans-serif">${(i * 0.15).toFixed(2)}s</span></div>`,
      )
      .join('')}</body>`;
    const sheet = await browser.newPage({ viewport: { width: 1800, height: 400 } });
    await sheet.setContent(html);
    await sheet.screenshot({ path: `${out}/${gait}-${character}.png`, fullPage: true });
    await sheet.close();
  }
  await page.close();
}
console.log(JSON.stringify(summary));
await browser.close();
