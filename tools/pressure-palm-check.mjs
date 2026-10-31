// Run against the preserved Vite lab: TAVI_TEST_URL=http://127.0.0.1:5175.
import { chromium, expect } from '@playwright/test';
import { writeFile, mkdir } from 'node:fs/promises';
const base = process.env.TAVI_TEST_URL ?? 'http://127.0.0.1:5175';
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  await page.goto(base + '/rig-lab');
  await expect(page.getByText('Comparison ready')).toBeVisible();
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await page.evaluate(async () => {
    const [{ createCharacterRenderer }, { getCharacter }, { demoFrame, demoPlacement }] =
      await Promise.all([
        import('/src/renderer/adapter.ts'),
        import('/src/renderer/characters/registry.ts'),
        import('/src/renderer/rig/demo.ts'),
      ]);
    const row = document.createElement('div');
    row.id = 'pressure-comparison';
    row.style.display = 'flex';
    document.body.append(row);
    window.pressureViews = [];
    for (const enabled of [false, true]) {
      const holder = document.createElement('div');
      holder.style.cssText =
        'width:675px;height:590px;position:relative;overflow:hidden;background:#e5dfd3;flex:none';
      row.append(holder);
      const canvas = document.createElement('canvas');
      canvas.style.cssText = 'position:absolute;inset:0;width:675px;height:590px';
      holder.append(canvas);
      const view = await createCharacterRenderer(canvas, getCharacter('tavi-foundation'));
      view.resize(675, 590);
      const frame = demoFrame('Sleep cycle', 3.4, 1, {}, true);
      if (!enabled) frame.tracks = frame.tracks.filter((t) => t.track !== 'runtime.palm-pressure');
      view.applyFrame(frame);
      view.draw(0, demoPlacement('Sleep cycle', 580, 675, 590, 3.4, true));
      window.pressureViews.push(view);
    }
  });
  const canvases = page.locator('#pressure-comparison > div');
  const off = await canvases.nth(0).screenshot(),
    on = await canvases.nth(1).screenshot();
  await mkdir('test-results/rig-foundation', { recursive: true });
  await writeFile('test-results/rig-foundation/pressure-off.png', off);
  await writeFile('test-results/rig-foundation/pressure-on.png', on);
  const difference = await page.evaluate(
    async ([a, b]) => {
      async function pixels(s) {
        const bitmap = await createImageBitmap(
          await (await fetch('data:image/png;base64,' + s)).blob(),
        );
        const c = document.createElement('canvas');
        c.width = bitmap.width;
        c.height = bitmap.height;
        const ctx = c.getContext('2d');
        ctx.drawImage(bitmap, 0, 0);
        bitmap.close();
        return ctx.getImageData(0, 0, c.width, c.height).data;
      }
      const x = await pixels(a),
        y = await pixels(b);
      let changedPixels = 0,
        maxDelta = 0;
      for (let i = 0; i < x.length; i += 4) {
        let delta = 0;
        for (let j = 0; j < 4; j++) delta = Math.max(delta, Math.abs(x[i + j] - y[i + j]));
        if (delta > 2) changedPixels++;
        maxDelta = Math.max(maxDelta, delta);
      }
      return { changedPixels, maxDelta };
    },
    [off.toString('base64'), on.toString('base64')],
  );
  expect(difference.changedPixels).toBeGreaterThan(20);
  expect(difference.changedPixels).toBeLessThan(2000);
  expect(difference.maxDelta).toBeGreaterThan(10);
  console.log('Actual Rive pressure layer is visible:', difference);
  await page.evaluate(() => window.pressureViews.forEach((v) => v.dispose()));
} finally {
  await browser.close();
}
