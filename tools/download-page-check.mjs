import { chromium, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
const base = process.env.TAVI_DOWNLOAD_TEST_URL ?? 'http://127.0.0.1:44925';
const output = 'test-results/download-page';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    reducedMotion: 'reduce',
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  let status = 200;
  await page.route('https://api.github.com/repos/Daniel-Shunom/Tavi/releases/latest', (route) =>
    route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify({
        assets: [
          {
            name: 'Tavi_0.1.0_x64-setup.exe',
            browser_download_url:
              'https://github.com/Daniel-Shunom/Tavi/releases/download/test/Tavi_x64-setup.exe',
          },
        ],
      }),
    }),
  );
  await page.goto(`${base}/download`);
  await expect(page.getByRole('heading', { level: 1, name: 'Take Tavi with you.' })).toBeVisible();
  await expect(page.locator('.site-hero')).toHaveCount(0);
  await expect(page.locator('.closing-scene')).toHaveCount(0);
  await expect(page.locator('.download-stage[data-tavi-ready="true"]')).toBeVisible({
    timeout: 30000,
  });
  expect(await page.evaluate(() => scrollY)).toBe(0);
  await expect(page.getByRole('link', { name: 'Download for Windows' })).toHaveAttribute(
    'href',
    /x64-setup\.exe$/,
  );
  await expect(page.getByRole('link', { name: 'Or try the browser preview' })).toHaveAttribute(
    'href',
    '/judge',
  );
  await page.getByRole('button', { name: 'Wave to Tavi' }).click();
  await page.screenshot({ path: `${output}/desktop.png`, fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: `${output}/mobile.png`, fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.getByRole('button', { name: 'Wave to Tavi' })).toBeVisible();
  status = 404;
  await page.reload();
  await expect(page.getByText('The Windows installer is coming soon.')).toBeVisible();
  status = 503;
  await page.reload();
  await expect(
    page.getByText('Could not check the installer. See Windows releases below.'),
  ).toBeVisible();
  await page.goto(base);
  await expect(page.locator('.closing-copy h2')).toHaveText('Make a littleyou.');
  await expect(page.getByRole('link', { name: 'Make Tavi yours', exact: true })).toHaveAttribute(
    'href',
    '/judge',
  );
  await page.locator('.closing-scene').scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${output}/landing-closing.png`, fullPage: false });
  expect(errors).toEqual([]);
  console.info(
    'PASS standalone download, drawn character, greeting, Windows installer link, preview link, missing/error release states, mobile layout, original landing copy, no browser errors.',
  );
} finally {
  await browser.close();
}
