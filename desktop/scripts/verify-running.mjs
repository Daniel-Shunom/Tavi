// Smoke-checks a running packaged Tavi service (for example the installed app) in Chromium:
// health, studio, overlay, Rive WASM + .riv loading, CSP/page errors, and live sync.
// Usage: node desktop/scripts/verify-running.mjs [baseUrl] [screenshotDir]
import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const base = process.argv[2] ?? 'http://127.0.0.1:4318';
const shots = process.argv[3];
const problems = [];
const assets = { wasm: 0, riv: 0 };
const check = (ok, label) => {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`);
  if (!ok) problems.push(label);
};

const health = await (await fetch(`${base}/api/health`)).json();
check(health.name === 'Tavi' && health.status === 'ok', `health ${JSON.stringify(health)}`);

const browser = await chromium.launch();
try {
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const watch = (page, name) => {
    page.on('pageerror', (error) => problems.push(`${name} page error: ${error.message}`));
    page.on('console', (message) => {
      // Emitted by the Rive runtime for an empty script inside the third-party mascot file;
      // it also appears in the Vite dev server and does not affect rendering.
      if (message.text().startsWith('Blank Script 1:1: module must return a value'))
        return console.log(`note: ${name} logs known Rive message "${message.text()}"`);
      if (message.type() === 'error' || /content security policy/i.test(message.text()))
        problems.push(`${name} console ${message.type()}: ${message.text()}`);
    });
    page.on('requestfailed', (request) =>
      problems.push(`${name} request failed: ${request.url()} ${request.failure()?.errorText}`),
    );
    page.on('response', (response) => {
      const url = response.url();
      if (response.status() >= 400) problems.push(`${name} HTTP ${response.status()} ${url}`);
      else if (url.endsWith('.wasm')) assets.wasm++;
      else if (url.endsWith('.riv')) assets.riv++;
    });
  };
  const studio = await context.newPage();
  watch(studio, 'studio');
  await studio.goto(base);
  await studio.getByText('Local service connected').waitFor({ timeout: 15000 });
  await studio.locator('canvas').first().waitFor({ timeout: 15000 });
  check(true, 'studio connected and rendered a canvas');

  const overlay = await context.newPage();
  watch(overlay, 'overlay');
  await overlay.goto(`${base}/overlay`);
  await overlay.locator('canvas').first().waitFor({ timeout: 15000 });
  const background = await overlay
    .locator('body')
    .evaluate((element) => getComputedStyle(element).backgroundColor);
  check(background === 'rgba(0, 0, 0, 0)', `overlay transparent background (${background})`);
  await overlay.waitForTimeout(2500);
  check(assets.wasm > 0, `Rive WASM loaded (${assets.wasm} responses)`);
  check(assets.riv > 0, `mascot .riv loaded (${assets.riv} responses)`);

  if (shots) {
    await mkdir(shots, { recursive: true });
    await studio.screenshot({ path: join(shots, 'studio.png') });
    await overlay.screenshot({ path: join(shots, 'overlay.png'), omitBackground: true });
  }
} finally {
  await browser.close();
}
for (const problem of problems) console.log(`  problem: ${problem}`);
console.log(problems.length ? `FAILED (${problems.length})` : 'ALL CHECKS PASSED');
process.exitCode = problems.length ? 1 : 0;
