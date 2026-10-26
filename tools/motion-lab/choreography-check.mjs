// Frame sequences of each entrance/exit in the motion lab at two sizes, written as contact sheets
// to test-results/motion-choreography/<id>-<size>.png, plus a JSON summary (distinct frames,
// final opacity). Usage: vite on TAVI_LAB_URL (default http://127.0.0.1:5191), then
//   node tools/motion-lab/choreography-check.mjs [id ...]
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

const base = process.env.TAVI_LAB_URL ?? 'http://127.0.0.1:5191';
const out = 'test-results/motion-choreography';
await mkdir(out, { recursive: true });
const all = [
  ['drop', 'show', 4],
  ['tiredWalk', 'show', 11],
  ['climb', 'show', 4.5],
  ['slideUp', 'show', 3.5],
  ['walkOff', 'hide', 4],
  ['jumpOut', 'hide', 1.9],
  ['hopOff', 'hide', 1.4],
  ['duck', 'hide', 1.4],
];
const wanted = process.argv.slice(2);
const runs = wanted.length ? all.filter(([id]) => wanted.includes(id)) : all;
const browser = await chromium.launch({
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const summary = {};
for (const [size, viewport] of [
  ['overlay', { width: 1300, height: 560 }],
  ['large', { width: 2600, height: 1100 }],
]) {
  const page = await browser.newPage({ viewport });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(base + '/tools/motion-lab/');
  await page.waitForFunction(() => document.body.dataset.ready);
  const stage = await page.locator('#after').boundingBox();
  // Crop around the character (home is the stage centre); walk-ins also need the right side.
  const crop = (wide) => ({
    x: stage.x + stage.width * (wide ? 0.3 : 0.36),
    y: stage.y + stage.height * 0.1,
    width: stage.width * (wide ? 0.7 : 0.28),
    height: stage.height * 0.9,
  });
  for (const [id, kind, seconds] of runs) {
    // Start from the opposite state.
    await page.evaluate(
      (k) => (k === 'show' ? window.lab.hide('duck') : window.lab.show('slideUp')),
      kind,
    );
    await page.waitForTimeout(kind === 'show' ? 1200 : 3200);
    // Step the lab clock deterministically: one capture every 0.1 s of motion time.
    await page.evaluate(() => window.lab.pause());
    await page.evaluate(([name, k]) => window.lab[k](name), [id, kind]);
    const shots = [];
    for (let t = 0; t < seconds; t += 0.1) {
      shots.push(
        (await page.screenshot({ clip: crop(id === 'tiredWalk' || id === 'walkOff') })).toString(
          'base64',
        ),
      );
      await page.evaluate(() => window.lab.advance(0.1));
    }
    await page.evaluate(() => window.lab.resume());
    const opacity = await page.evaluate(
      () => getComputedStyle(document.querySelector('#after canvas')).opacity,
    );
    summary[`${id}-${size}`] = {
      frames: shots.length,
      distinct: new Set(shots).size,
      opacityAfter: opacity,
    };
    const cols = 10;
    const html = `<body style="margin:0;display:grid;grid-template-columns:repeat(${cols},1fr);background:#fff">${shots
      .map(
        (s, i) =>
          `<div style="position:relative"><img src="data:image/png;base64,${s}" style="width:100%"><span style="position:absolute;left:2px;top:0;font:10px sans-serif">${i}</span></div>`,
      )
      .join('')}</body>`;
    const sheet = await browser.newPage({ viewport: { width: 1600, height: 400 } });
    await sheet.setContent(html);
    await sheet.screenshot({ path: `${out}/${id}-${size}.png`, fullPage: true });
    await sheet.close();
  }
  summary[`errors-${size}`] = errors;
  await page.close();
}
await writeFile(`${out}/summary.json`, JSON.stringify(summary, null, 1));
console.log(JSON.stringify(summary));
await browser.close();
