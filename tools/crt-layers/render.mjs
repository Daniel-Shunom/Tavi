// Renders the CRT hero layers from the 3D scene: node tools/crt-layers/render.mjs [origin] [outDir]
// Needs the Vite dev server (npm run dev) for the TypeScript harness and the public models.
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
const origin = process.argv[2] ?? 'http://127.0.0.1:5173';
const out = process.argv[3] ?? 'build/crt-layers';
await mkdir(out, { recursive: true });
// A real GPU path is not needed: the scene renders once.
const browser = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
page.on('pageerror', (e) => console.error('pageerror', e.message));
for (const layer of ['table', 'tv', 'glass-shine', 'full']) {
  await page.goto(`${origin}/tools/crt-layers/index.html?layer=${layer}&width=1800`);
  const data = await page.locator('#done').evaluate((e) => e.value, null, { timeout: 120000 });
  await writeFile(`${out}/${layer}.png`, Buffer.from(data.split(',')[1], 'base64'));
  console.log('rendered', layer);
}
await browser.close();
