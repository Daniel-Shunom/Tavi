import { chromium, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const base = process.env.TAVI_JUDGING_TEST_URL ?? 'http://127.0.0.1:44910';
const output = 'test-results/judging';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const errors = [];
const watch = (page) => page.on('pageerror', (error) => errors.push(error.message));
async function enter(context) {
  const page = await context.newPage();
  watch(page);
  await page.goto(`${base}/judge`);
  await expect(page.getByRole('button', { name: 'Start preview', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Start preview', exact: true }).click();
  await page.waitForURL(/\/studio\?judge=/);
  await expect(page.getByRole('button', { name: 'Skip for now' })).toBeVisible();
  await page.getByRole('button', { name: 'Skip for now' }).click();
  await expect(page.locator('canvas[aria-label]')).toBeVisible();
  return page;
}
function api(page, path) {
  return `${base}${path}${new URL(page.url()).search}`;
}
async function rename(page, name) {
  await page.evaluate(
    (name) =>
      new Promise((resolve, reject) => {
        const socket = new WebSocket(
          `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws${location.search}`,
        );
        const timer = setTimeout(() => {
          socket.close();
          reject(new Error('Character update timed out'));
        }, 15000);
        socket.onopen = () => socket.send(JSON.stringify({ type: 'configure', patch: { name } }));
        socket.onmessage = ({ data }) => {
          const message = JSON.parse(data);
          if (message.state?.config.name !== name) return;
          clearTimeout(timer);
          socket.close();
          resolve();
        };
        socket.onerror = () => {
          clearTimeout(timer);
          reject(new Error('Character socket failed'));
        };
      }),
    name,
  );
}
try {
  const first = await browser.newContext({
    viewport: { width: 1512, height: 1100 },
    reducedMotion: 'reduce',
  });
  const second = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    reducedMotion: 'reduce',
  });
  const page = await enter(first);
  const bar = page.getByRole('complementary', { name: 'Preview session' });
  await expect(bar).toBeVisible();
  expect((await bar.boundingBox()).height).toBeLessThan(160);
  const other = await enter(second);
  await rename(page, 'Judging one');
  expect((await (await other.request.get(api(other, '/api/state'))).json()).config.name).not.toBe(
    'Judging one',
  );
  const metadata = await (await page.request.get(api(page, '/api/judging/session'))).json();
  const overlay = await first.newPage();
  watch(overlay);
  await overlay.goto(metadata.overlayUrl);
  await expect(overlay.locator('canvas[aria-label]')).toBeVisible();
  expect(
    (
      await (
        await overlay.request.get(`${base}/api/state${new URL(metadata.overlayUrl).search}`)
      ).json()
    ).config.name,
  ).toBe('Judging one');
  expect(await overlay.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe(
    'rgba(0, 0, 0, 0)',
  );
  const forbidden = await overlay.request.post(
    `${base}/api/judging/reset${new URL(metadata.overlayUrl).search}`,
    {
      headers: { origin: base, 'x-tavi-request': 'studio' },
    },
  );
  expect(forbidden.status()).toBe(403);
  await page.getByRole('button', { name: 'Add 15 min', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Extension used', exact: true })).toBeDisabled();
  const extended = await (await page.request.get(api(page, '/api/judging/session'))).json();
  expect(extended.expiresAt - metadata.expiresAt).toBe(15 * 60_000);
  await page.getByRole('button', { name: 'Reset preview', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Skip for now' })).toBeVisible();
  const reset = await (await page.request.get(api(page, '/api/judging/session'))).json();
  expect(reset.epoch).toBe(1);
  expect(reset.expiresAt).toBe(extended.expiresAt);
  expect(reset.overlayUrl).toBe(metadata.overlayUrl);
  await page.getByRole('button', { name: 'Skip for now' }).click();
  await page.screenshot({ path: `${output}/studio.png`, fullPage: true });
  await overlay.screenshot({ path: `${output}/overlay.png`, omitBackground: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: `${output}/mobile.png`, fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
  console.info(
    'PASS: separate sessions, live overlay, view-only access, extension, reset, responsive layout, no browser errors.',
  );
} finally {
  await browser.close();
}
