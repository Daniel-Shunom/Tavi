import { chromium, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const base = process.env.TAVI_TEST_URL ?? 'http://127.0.0.1:4318';
await mkdir('test-results/youtube', { recursive: true });
const browser = await chromium.launch({ headless: true });
const errors = [];
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1080 },
    reducedMotion: 'reduce',
  });
  const page = await context.newPage();
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(base + '/studio');
  await page.getByRole('button', { name: 'Streaming on YouTube? Set up YouTube' }).click();
  await expect(page.getByRole('heading', { name: 'YouTube connection' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Twitch connection' })).toBeVisible();
  const status = await (await page.request.get(base + '/api/youtube')).json();
  expect(status.configured).toBe(false);
  await expect(page.getByRole('button', { name: 'Connect YouTube', exact: true })).toBeDisabled();
  await expect(page.getByText(/YouTube sign-in is not available in this version/)).toBeVisible();
  await page
    .getByRole('heading', { name: 'YouTube connection' })
    .evaluate((node) => node.scrollIntoView({ block: 'start' }));
  await page.screenshot({ path: 'test-results/youtube/setup-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .getByRole('heading', { name: 'YouTube connection' })
    .evaluate((node) => node.scrollIntoView({ block: 'start' }));
  await page.screenshot({ path: 'test-results/youtube/setup-mobile.png', fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

  // UI states below are explicit test fixtures, never a claimed real Google connection.
  let fixture = {
    configured: true,
    phase: 'authorizing',
    account: null,
    authorization: {
      url: 'https://accounts.google.com/o/oauth2/v2/auth?test=fixture',
      expiresAt: Date.now() + 600000,
    },
    broadcasts: [],
    broadcastId: null,
    error: null,
    messages: [],
  };
  await page.route('**/api/youtube', (route) => route.fulfill({ json: fixture }));
  const google = page.getByRole('link', { name: 'Sign in with Google' });
  await expect(google).toBeVisible();
  await expect(google).toHaveAttribute('href', fixture.authorization.url);
  fixture = {
    ...fixture,
    phase: 'waiting',
    account: { id: 'test', title: 'Test channel' },
    authorization: null,
  };
  await expect(page.getByText(/Waiting for a live broadcast with chat enabled/)).toBeVisible();
  fixture = {
    ...fixture,
    phase: 'connected',
    broadcasts: [{ id: 'stream', title: 'Test broadcast' }],
    broadcastId: 'stream',
    messages: [
      {
        id: 'youtube:test',
        userId: 'youtube:viewer',
        author: 'Fixture viewer',
        text: 'Hi Tavi!',
        receivedAt: Date.now(),
      },
    ],
  };
  await expect(page.getByLabel('Recent YouTube messages')).toBeVisible();
  await page
    .getByRole('heading', { name: 'YouTube connection' })
    .evaluate((node) => node.scrollIntoView({ block: 'start' }));
  await page.screenshot({ path: 'test-results/youtube/chat-fixture-mobile.png', fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1080 });
  await page.screenshot({ path: 'test-results/youtube/chat-fixture-desktop.png', fullPage: true });
  const overlay = await context.newPage();
  overlay.on('pageerror', (error) => errors.push(error.message));
  await overlay.goto(base + '/overlay');
  await expect(overlay.locator('canvas[aria-label]')).toBeVisible();
  await expect(overlay.locator('header')).toHaveCount(0);
  expect(errors).toEqual([]);
  console.log(
    'YouTube browser checks passed: welcome entry, real unconfigured status, fixture authorization/waiting/chat, desktop/mobile, and OBS overlay rendering. No real Google account was used.',
  );
} finally {
  await browser.close();
}
