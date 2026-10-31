// Records real-time screen footage of the landing page and Studio for the trailer:
//   public/footage/screens/landing.mp4    a slow scroll down the site (Tavi follows)
//   public/footage/screens/studio.mp4     the sign-in screen, then every Studio view, dark theme
// Needs the built service running (TAVI_PORT=4325 npx tsx server/index.ts from the repo root).
// Usage: node capture/screens.mjs [landing|studio]   (from video/; TAVI_SITE_URL overrides the service)
import { chromium } from '@playwright/test';
import { spawnSync } from 'node:child_process';
import { mkdir, readdir, rename, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const base = process.env.TAVI_SITE_URL ?? 'http://127.0.0.1:4325';
const out = join(here, '..', 'public', 'footage', 'screens');
const size = { width: 1920, height: 1080 };
await mkdir(out, { recursive: true });

const browser = await chromium.launch({
  args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu-rasterization'],
});

const only = process.argv.slice(2);
async function record(name, run) {
  if (only.length && !only.includes(name)) return;
  const dir = join(out, `.${name}`);
  await rm(dir, { recursive: true, force: true });
  const context = await browser.newContext({
    viewport: size,
    deviceScaleFactor: 1,
    recordVideo: { dir, size },
    reducedMotion: 'no-preference',
    colorScheme: 'dark',
  });
  const page = await context.newPage();
  const started = Date.now();
  try {
    await run(page);
  } finally {
    await context.close();
  }
  const [file] = await readdir(dir);
  const webm = join(out, `${name}.webm`);
  await rename(join(dir, file), webm);
  await rm(dir, { recursive: true, force: true });
  // Playwright's variable-rate WebM has no index Remotion can seek; re-encode to constant-rate MP4.
  const encode = spawnSync(
    'npx',
    [
      'remotion',
      'ffmpeg',
      '-y',
      '-i',
      webm,
      '-r',
      '30',
      '-c:v',
      'libx264',
      '-crf',
      '18',
      '-pix_fmt',
      'yuv420p',
      '-an',
      join(out, `${name}.mp4`),
    ],
    { cwd: join(here, '..'), shell: true, stdio: 'ignore' },
  );
  if (encode.status !== 0) throw new Error(`ffmpeg failed for ${name}.webm`);
  await rm(webm, { force: true });
  console.log(`${name}.mp4: ${String(Math.round((Date.now() - started) / 1000))}s`);
}

await record('landing', async (page) => {
  await page.goto(`${base}/`);
  await page.locator('canvas').first().waitFor({ timeout: 30000 });
  await page.waitForTimeout(2500);
  // A steady scroll to the bottom and a short hold; the page's own choreography does the rest.
  const total = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
  const steps = 420;
  for (let step = 1; step <= steps; step++) {
    const eased = 0.5 - Math.cos((step / steps) * Math.PI) / 2;
    await page.evaluate((y) => window.scrollTo(0, y), Math.round(total * eased));
    await page.waitForTimeout(40);
  }
  await page.waitForTimeout(3000);
});

await record('studio', async (page) => {
  await page.addInitScript(() => {
    localStorage.setItem('tavi.studio.theme', 'afterhours');
    localStorage.removeItem('tavi.studio.twitch');
  });
  await page.goto(`${base}/studio`);
  // Builds with the Twitch sign-in screen show it first; older ones go straight to Studio.
  const skip = page.getByRole('button', { name: 'Skip for now' });
  const connected = page.getByText('Local service connected');
  await skip.or(connected).first().waitFor({ timeout: 30000 });
  if (await skip.isVisible()) {
    await page.waitForTimeout(3500);
    await skip.click();
  }
  await connected.waitFor({ timeout: 30000 });
  await page.waitForTimeout(2500);
  for (const key of ['1', '2', '3']) {
    await page.keyboard.press(key);
    await page.waitForTimeout(2200);
  }
  for (const view of ['#look', '#personality', '#setup']) {
    await page.evaluate((hash) => {
      location.hash = hash;
    }, view);
    await page.waitForTimeout(3500);
  }
  await page.evaluate(() => {
    location.hash = '#live';
  });
  await page.waitForTimeout(3000);
});

await browser.close();
