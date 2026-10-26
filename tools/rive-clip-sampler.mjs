// Renders every animation of a character's artboard in a real browser and reports how many pixels
// each one changes relative to the rest pose. Names alone do not prove a clip does anything.
// Requires a Vite dev server: TAVI_TEST_URL=http://127.0.0.1:5173 node tools/rive-clip-sampler.mjs [character]
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
const base = process.env.TAVI_TEST_URL ?? 'http://127.0.0.1:5173';
const character = process.argv[2] ?? 'mascot';
const browser = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader'] });
try {
  const page = await browser.newPage({ viewport: { width: 400, height: 400 } });
  await page.goto(base + '/?sampler');
  const report = await page.evaluate(async (id) => {
    const registry = await import('/src/renderer/characters/registry.ts');
    const rive = await import('/src/renderer/rive/riveRenderer.ts');
    const manifest = registry.getCharacter(id);
    document.body.innerHTML = '';
    const canvas = document.createElement('canvas');
    canvas.style.width = '300px';
    canvas.style.height = '300px';
    document.body.append(canvas);
    const view = await rive.createRiveRenderer(canvas, manifest);
    view.resize(300, 300);
    const copy = document.createElement('canvas');
    copy.width = canvas.width;
    copy.height = canvas.height;
    const context = copy.getContext('2d', { willReadFrequently: true });
    const placement = { x: 150, y: 295, width: 260, height: 290, rotation: 0 };
    function capture(clip, position) {
      view.debugSample(clip, position);
      view.draw(0, placement);
      context.clearRect(0, 0, copy.width, copy.height);
      context.drawImage(canvas, 0, 0);
      return context.getImageData(0, 0, copy.width, copy.height).data;
    }
    const results = [];
    for (const clip of view.debugClips()) {
      let changed = 0;
      for (const position of [0.25, 0.5, 0.75]) {
        // Baseline immediately before each sample: earlier clips can leave un-keyed state behind.
        const rest = capture(null, 0).slice();
        const sample = capture(clip, position);
        let count = 0;
        for (let i = 0; i < sample.length; i += 4) {
          if (
            Math.abs(sample[i] - rest[i]) +
              Math.abs(sample[i + 1] - rest[i + 1]) +
              Math.abs(sample[i + 2] - rest[i + 2]) +
              Math.abs(sample[i + 3] - rest[i + 3]) >
            24
          )
            count++;
        }
        changed = Math.max(changed, count);
      }
      const strip = document.createElement('canvas');
      strip.width = 5 * 160;
      strip.height = 160;
      const stripContext = strip.getContext('2d');
      [0.1, 0.3, 0.5, 0.7, 0.9].forEach((position, index) => {
        capture(clip, position);
        stripContext.drawImage(copy, 0, 0, copy.width, copy.height, index * 160, 0, 160, 160);
      });
      const pixels = capture(clip, 0.5);
      let minX = Infinity,
        minY = Infinity,
        maxX = -1,
        maxY = -1;
      for (let y = 0; y < copy.height; y++)
        for (let x = 0; x < copy.width; x++)
          if (pixels[(y * copy.width + x) * 4 + 3] > 16) {
            minX = Math.min(minX, x);
            maxX = Math.max(maxX, x);
            minY = Math.min(minY, y);
            maxY = Math.max(maxY, y);
          }
      results.push({
        clip,
        changedPixels: changed,
        bounds: { minX, minY, maxX, maxY },
        image: strip.toDataURL('image/png'),
      });
    }
    // Which clips key the overall framing scale? Prime with each clip at 0 then measure height.
    function unusedHeight(prime, clip, position = 0) {
      view.debugSample(prime, 0);
      view.draw(0, placement);
      view.debugSample(clip, position);
      view.draw(0, placement);
      context.clearRect(0, 0, copy.width, copy.height);
      context.drawImage(canvas, 0, 0);
      const pixels = context.getImageData(0, 0, copy.width, copy.height).data;
      let top = Infinity,
        bottom = -1;
      for (let i = 3; i < pixels.length; i += 4)
        if (pixels[i] > 16) {
          const y = Math.floor((i - 3) / 4 / copy.width);
          top = Math.min(top, y);
          bottom = Math.max(bottom, y);
        }
      return bottom - top;
    }
    view.dispose();
    // Some clips also key the artboard's overall framing. Measure each from a fresh setup pose.
    for (const row of results) {
      const fresh = await rive.createRiveRenderer(canvas, manifest);
      fresh.resize(300, 300);
      const measure = (clip, position) => {
        fresh.debugSample(clip, position);
        fresh.draw(0, placement);
        context.clearRect(0, 0, copy.width, copy.height);
        context.drawImage(canvas, 0, 0);
        const pixels = context.getImageData(0, 0, copy.width, copy.height).data;
        let top = Infinity,
          bottom = -1;
        for (let i = 3; i < pixels.length; i += 4)
          if (pixels[i] > 16) {
            const y = Math.floor((i - 3) / 4 / copy.width);
            top = Math.min(top, y);
            bottom = Math.max(bottom, y);
          }
        return bottom - top;
      };
      const before = measure(null, 0);
      const after = measure(row.clip, 0.5);
      const restored = measure(null, 0);
      row.framing = { before, after, restored };
      fresh.dispose();
    }
    return results;
  }, character);
  await mkdir('test-results', { recursive: true });
  await mkdir(`test-results/clips-${character}`, { recursive: true });
  for (const row of report) {
    await writeFile(
      `test-results/clips-${character}/${row.clip}.png`,
      Buffer.from(row.image.split(',')[1], 'base64'),
    );
    delete row.image;
  }
  await writeFile(`test-results/clip-sample-${character}.json`, JSON.stringify(report, null, 2));
  for (const row of report)
    console.log(
      `${String(row.changedPixels).padStart(7)}  ${row.clip.padEnd(18)} framing ${JSON.stringify(row.framing)}`,
    );
} finally {
  await browser.close();
}
