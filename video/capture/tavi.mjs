// Captures Tavi footage for the trailer: transparent PNG sequences of the real renderer, stepped
// frame by frame with Playwright's fake clock so motion is exact regardless of machine speed.
// Needs the repo served by Vite (default http://localhost:5190, see TAVI_STAGE_URL).
// Usage: node capture/tavi.mjs [shot ...]      (from video/; all shots when none are named)
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fps, shots } from './shots.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const base = process.env.TAVI_STAGE_URL ?? 'http://localhost:5190';
const out = join(here, '..', 'public', 'footage', 'tavi');
const names = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(shots);
const parallel = Number(process.env.CAPTURE_PARALLEL ?? 4);
const START = new Date('2026-10-31T12:00:00Z').getTime();

for (const name of names) if (!shots[name]) throw new Error(`unknown shot ${name}`);

const browser = await chromium.launch({
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});

async function capture(name) {
  const shot = shots[name];
  const folder = join(out, name);
  await mkdir(folder, { recursive: true });
  const page = await browser.newPage({
    viewport: { width: shot.width, height: shot.height },
    deviceScaleFactor: shot.scale,
  });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error' && !message.text().startsWith('Blank Script'))
      errors.push(message.text());
  });
  await page.clock.install({ time: START });
  await page.goto(`${base}/video/capture/stage/?presentation=${shot.presentation}`);
  await page.waitForFunction(
    () => document.body.dataset.ready || document.body.dataset.error,
    null,
    { timeout: 120000 },
  );
  const failure = await page.evaluate(() => document.body.dataset.error);
  if (failure) throw new Error(`${name}: ${failure}`);
  if (shot.config) await page.evaluate((patch) => window.stage.config(patch), shot.config);
  // Let the renderer settle on the real clock, then freeze time and step it ourselves.
  await page.waitForTimeout(600);
  await page.clock.pauseAt(START + 5000);
  await page.clock.runFor(1200);
  const total = Math.round(shot.seconds * fps);
  const pending = [...shot.actions].sort((a, b) => a[0] - b[0]);
  const started = Date.now();
  for (let frame = 0; frame < total; frame++) {
    const seconds = frame / fps;
    while (pending.length && pending[0][0] <= seconds) {
      const [, code] = pending.shift();
      await page.evaluate(`(() => { const stage = window.stage; return ${code}; })()`);
    }
    await page.clock.runFor(1000 / fps);
    await page.screenshot({
      path: join(folder, `${String(frame).padStart(5, '0')}.png`),
      omitBackground: true,
      animations: 'disabled',
    });
    if (frame % 60 === 0)
      console.log(
        `${name}: ${String(frame)}/${String(total)} (${String(Math.round((Date.now() - started) / 1000))}s)`,
      );
  }
  await writeFile(
    join(folder, 'meta.json'),
    JSON.stringify(
      {
        name,
        fps,
        frames: total,
        width: shot.width * shot.scale,
        height: shot.height * shot.scale,
        presentation: shot.presentation,
        actions: shot.actions,
        errors,
      },
      null,
      2,
    ),
  );
  await page.close();
  console.log(
    `${name}: done, ${String(total)} frames${errors.length ? `, errors: ${errors.join(' | ')}` : ''}`,
  );
}

const queue = [...names];
await Promise.all(
  Array.from({ length: Math.min(parallel, queue.length) }, async () => {
    while (queue.length) await capture(queue.shift());
  }),
);
await browser.close();
