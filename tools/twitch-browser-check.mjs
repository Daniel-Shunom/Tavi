import { chromium, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1512, height: 1100 } });
  let status = {
    phase: 'disconnected',
    account: null,
    authorization: null,
    error: null,
    messages: [],
  };
  await page.route('**/api/twitch', (route) => route.fulfill({ json: status }));
  await page.route('**/api/twitch/connect', (route) => {
    status = {
      ...status,
      phase: 'authorizing',
      authorization: {
        userCode: 'BROWSER-TEST',
        verificationUri: 'https://www.twitch.tv/activate?device-code=BROWSER-TEST',
        expiresAt: Date.now() + 120000,
      },
    };
    return route.fulfill({ json: status });
  });
  await page.route('**/api/twitch/disconnect', (route) => {
    status = {
      phase: 'disconnected',
      account: null,
      authorization: null,
      error: null,
      messages: [],
    };
    return route.fulfill({ json: status });
  });
  await page.goto('http://127.0.0.1:5173/studio#setup');
  // A fresh browser meets the Twitch sign-in screen first.
  await page.getByRole('button', { name: 'Skip for now' }).click();
  await expect(page.getByRole('button', { name: 'Connect Twitch', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Connect Twitch', exact: true }).click();
  await expect(page.getByText('BROWSER-TEST', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Authorize on Twitch' })).toHaveAttribute(
    'href',
    'https://www.twitch.tv/activate?device-code=BROWSER-TEST',
  );
  await page.getByRole('button', { name: 'Cancel connection' }).click();
  await expect(page.getByRole('button', { name: 'Connect Twitch', exact: true })).toBeVisible();
  status = {
    phase: 'connected',
    account: { id: '42', login: 'teststreamer' },
    authorization: null,
    error: null,
    messages: [
      {
        id: '1',
        userId: '2',
        author: 'Pixel',
        text: '<img src=x onerror=alert(1)> hello Tavi',
        receivedAt: Date.now(),
      },
    ],
  };
  await expect(page.getByText('Chat connected', { exact: true })).toBeVisible();
  await expect(
    page.getByText('<img src=x onerror=alert(1)> hello Tavi', { exact: true }),
  ).toBeVisible();
  await expect(page.locator('.live-chat img')).toHaveCount(0);
  await mkdir('test-results', { recursive: true });
  await page.screenshot({ path: 'test-results/twitch-studio.png', fullPage: true });
  await page.getByRole('button', { name: 'Disconnect Twitch', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Connect Twitch', exact: true })).toBeVisible();
  console.log(
    'Twitch browser checks passed: connect, authorization link/code, cancellation, live chat text escaping, disconnect.',
  );
} finally {
  await browser.close();
}
