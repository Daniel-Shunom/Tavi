// Deterministic HTTP ordering regressions from the YouTube PR review.
import { chromium, expect } from '@playwright/test';
const base = process.env.TAVI_TEST_URL ?? 'http://127.0.0.1:4322';
const browser = await chromium.launch({ headless: true });
const failures = [];
const disconnected = {
  configured: true,
  phase: 'disconnected',
  account: null,
  authorization: null,
  broadcasts: [],
  broadcastId: null,
  error: null,
  messages: [],
};
const authorized = {
  ...disconnected,
  phase: 'authorizing',
  authorization: {
    url: 'https://accounts.google.com/o/oauth2/v2/auth?test=fixture',
    expiresAt: Date.now() + 600000,
  },
};
const waiting = {
  ...disconnected,
  phase: 'waiting',
  account: { id: 'test', title: 'Test channel' },
};
async function check(name, run) {
  const context = await browser.newContext({ reducedMotion: 'reduce' });
  await context.addInitScript(() => localStorage.setItem('tavi.studio.twitch', 'skipped'));
  const page = await context.newPage();
  try {
    await run(page);
    console.log('PASS ' + name);
  } catch (error) {
    failures.push(name + ': ' + error.message);
    console.log('FAIL ' + name);
  } finally {
    await context.close();
  }
}
try {
  await check('unknown or failed status does not claim the build is unconfigured', async (page) => {
    let release;
    const held = new Promise((resolve) => {
      release = resolve;
    });
    await page.route('**/api/youtube', async (route) => {
      await held;
      await route.fulfill({ status: 503, body: '{}' }).catch(() => {});
    });
    await page.goto(base + '/studio#setup');
    await expect(page.getByRole('heading', { name: 'YouTube connection' })).toBeVisible();
    try {
      await expect(page.getByText(/YouTube sign-in is not available in this version/)).toHaveCount(
        0,
      );
      await expect(page.getByText('Checking YouTube connection...')).toBeVisible();
    } finally {
      release();
    }
    await expect(
      page.getByRole('alert').filter({ hasText: 'YouTube status is unavailable' }),
    ).toBeVisible();
    await expect(page.getByText(/YouTube sign-in is not available in this version/)).toHaveCount(0);
  });
  await check(
    'an older GET cannot overwrite a Connect result, and polling resumes',
    async (page) => {
      let reads = 0;
      let release;
      let holding;
      const held = new Promise((resolve) => {
        release = resolve;
      });
      const started = new Promise((resolve) => {
        holding = resolve;
      });
      let remote = disconnected;
      await page.route('**/api/youtube', async (route) => {
        if (++reads === 2) {
          holding();
          await held;
          await route.fulfill({ json: disconnected }).catch(() => {});
        } else await route.fulfill({ json: remote });
      });
      await page.route('**/api/youtube/connect', async (route) => {
        remote = authorized;
        await route.fulfill({ json: authorized });
      });
      await page.goto(base + '/studio#setup');
      await expect(
        page.getByRole('button', { name: 'Connect YouTube', exact: true }),
      ).toBeEnabled();
      await started;
      await page.getByRole('button', { name: 'Connect YouTube', exact: true }).click();
      const link = page.getByRole('link', { name: 'Sign in with Google' });
      await expect(link).toBeVisible();
      release();
      await page.waitForTimeout(150); // Commit the deliberately late response before the next poll.
      await expect(link).toBeVisible({ timeout: 300 });
      remote = waiting;
      await expect(page.getByText(/Waiting for a live broadcast with chat enabled/)).toBeVisible();
    },
  );
  await check(
    'successful status reads preserve failed action errors until a retry',
    async (page) => {
      let reads = 0;
      const remote = {
        ...waiting,
        broadcasts: [
          { id: 'one', title: 'First stream' },
          { id: 'two', title: 'Second stream' },
        ],
      };
      await page.route('**/api/youtube', (route) => {
        ++reads;
        return route.fulfill({ json: remote });
      });
      await page.route('**/api/youtube/select', (route) =>
        route.fulfill({ status: 400, json: { error: 'Broadcast ended' } }),
      );
      await page.route('**/api/youtube/disconnect', (route) =>
        route.fulfill({ json: disconnected }),
      );
      await page.goto(base + '/studio#setup');
      await page.getByRole('button', { name: 'First stream', exact: true }).click();
      const error = page.getByRole('alert').filter({ hasText: 'Could not update YouTube' });
      await expect(error).toBeVisible();
      const before = reads;
      await expect.poll(() => reads).toBeGreaterThan(before);
      await page.waitForTimeout(150);
      await expect(error).toBeVisible({ timeout: 300 });
      await page.getByRole('button', { name: 'Disconnect YouTube', exact: true }).click();
      await expect(error).toHaveCount(0);
    },
  );
} finally {
  await browser.close();
}
if (failures.length) throw new Error(failures.join('\n'));
console.log('YouTube review browser regressions passed. All Google responses were fixtures.');
