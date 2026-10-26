import { chromium, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
const base = process.env.TAVI_TEST_URL ?? 'http://127.0.0.1:5173';
const browser = await chromium.launch({ headless: true });
const errors = [];
let original;
let currentPage;
async function apply(page, commands) {
  await page.evaluate(async (commands) => {
    await new Promise((resolve, reject) => {
      const socket = new WebSocket(`ws://${location.host}/ws`);
      const timeout = setTimeout(() => {
        socket.close();
        reject(new Error('Timed out applying test state'));
      }, 5000);
      let count = -1;
      socket.onmessage = () => {
        if (count === -1) {
          count = 0;
          for (const command of commands) socket.send(JSON.stringify(command));
        } else if (++count >= commands.length) {
          clearTimeout(timeout);
          socket.close();
          resolve();
        }
      };
      socket.onerror = () => {
        clearTimeout(timeout);
        reject(new Error('Test socket failed'));
      };
    });
  }, commands);
}
try {
  const context = await browser.newContext({
    viewport: { width: 1512, height: 1100 },
    reducedMotion: 'reduce',
  });
  const page = await context.newPage();
  currentPage = page;
  page.on('pageerror', (error) => errors.push(error.message));
  // The public landing page now lives at `/`; exercise the editable Studio explicitly.
  await page.goto(base + '/studio');
  await expect(page.getByText('Local service connected')).toBeVisible();
  await expect(page.locator('canvas[aria-label]')).toBeVisible();
  const config = await (await page.request.get(base + '/api/state')).json();
  original = config;
  await apply(page, [
    { type: 'quiet', value: false },
    { type: 'retract', value: false },
  ]);
  const overlay = await context.newPage();
  overlay.on('pageerror', (error) => errors.push(error.message));
  await overlay.goto(base + '/overlay');
  await expect(overlay.locator('canvas[aria-label]')).toBeVisible();
  await expect(overlay.locator('header')).toHaveCount(0);
  expect(await overlay.locator('body').evaluate((el) => getComputedStyle(el).backgroundColor)).toBe(
    'rgba(0, 0, 0, 0)',
  );
  await page.getByLabel('Companion name').fill('Mochi');
  await expect
    .poll(async () => (await (await page.request.get(base + '/api/state')).json()).config.name)
    .toBe('Mochi');
  await page.getByRole('button', { name: 'shy', exact: false }).click();
  await page.getByRole('button', { name: 'Say it', exact: true }).click();
  // Typed lines go through the active decision provider; without keys that is labelled rules.
  await expect
    .poll(
      async () =>
        (await (await page.request.get(base + '/api/state')).json()).performance.script?.decidedBy
          .kind,
    )
    .toMatch(/^(rules|ai|local)$/);
  await page.getByRole('button', { name: 'Tuck away', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Bring Tavi back' })).toBeVisible();
  await page.getByRole('button', { name: 'Bring Tavi back' }).click();
  await page.getByRole('tab', { name: 'Placement' }).click();
  await page.getByLabel('Favorite perch').selectOption('chat');
  await expect
    .poll(async () => (await (await page.request.get(base + '/api/state')).json()).config.x)
    .toBe(0.82);
  // Restore the pre-test character through the same validated public boundary.
  await page.evaluate(async (config) => {
    await new Promise((resolve, reject) => {
      const socket = new WebSocket(`ws://${location.host}/ws`);
      let initialized = false;
      socket.onmessage = () => {
        if (!initialized) {
          initialized = true;
          const { version: _version, ...patch } = config;
          socket.send(JSON.stringify({ type: 'configure', patch }));
        } else {
          socket.close();
          resolve();
        }
      };
      socket.onerror = reject;
    });
  }, config.config);
  await page.getByRole('tab', { name: 'Character', exact: true }).click();
  await mkdir('test-results', { recursive: true });
  await page.screenshot({ path: 'test-results/studio.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  if (errors.length) throw new Error(errors.join('\n'));
  console.log(
    'Browser checks passed: renderer, customization, personality reaction, retraction, placement, transparent overlay, and mobile overflow.',
  );
} finally {
  if (original && currentPage) {
    const { version: _version, ...patch } = original.config;
    await apply(currentPage, [
      { type: 'configure', patch },
      { type: 'quiet', value: original.quiet },
      { type: 'retract', value: original.retracted },
    ]).catch((error) => {
      console.error('Could not restore the pre-test character:', error.message);
    });
  }
  await browser.close();
}
