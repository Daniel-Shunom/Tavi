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
  let fullRelease = true;
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
          {
            name: 'Tavi Studio_0.1.0_aarch64.dmg',
            browser_download_url:
              'https://github.com/Daniel-Shunom/Tavi/releases/download/test/Tavi_aarch64.dmg',
          },
          {
            name: 'Tavi Studio_0.1.0_x64.dmg',
            browser_download_url:
              'https://github.com/Daniel-Shunom/Tavi/releases/download/test/Tavi_x64.dmg',
          },
          {
            name: 'Tavi Studio_0.1.0_amd64.deb',
            browser_download_url:
              'https://github.com/Daniel-Shunom/Tavi/releases/download/test/Tavi_amd64.deb',
          },
          {
            name: 'Tavi Studio_0.1.0_amd64.AppImage',
            browser_download_url:
              'https://github.com/Daniel-Shunom/Tavi/releases/download/test/Tavi_amd64.AppImage',
          },
        ].filter((asset) => fullRelease || asset.name.endsWith('.exe')),
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
  await expect(
    page.getByRole('link', { name: 'Try the browser preview', exact: true }),
  ).toHaveAttribute('href', '/judge');
  await page.getByRole('tab', { name: 'macOS' }).click();
  await expect(page.getByRole('link', { name: 'Download for Apple Silicon' })).toHaveAttribute(
    'href',
    /aarch64\.dmg$/,
  );
  await expect(page.getByRole('link', { name: 'Download for Intel Mac' })).toHaveAttribute(
    'href',
    /x64\.dmg$/,
  );
  await page.screenshot({ path: `${output}/macos.png`, fullPage: true });
  await page.getByRole('tab', { name: 'Linux' }).click();
  await expect(page.getByRole('link', { name: 'Download .deb', exact: true })).toHaveAttribute(
    'href',
    /amd64\.deb$/,
  );
  await expect(page.getByRole('link', { name: 'Download AppImage' })).toHaveAttribute(
    'href',
    /amd64\.AppImage$/,
  );
  await page.screenshot({ path: `${output}/linux.png`, fullPage: true });
  await page.getByRole('tab', { name: 'Linux' }).press('ArrowLeft');
  await expect(page.getByRole('tab', { name: 'macOS' })).toBeFocused();
  await page.getByRole('tab', { name: 'macOS' }).press('Home');
  await expect(page.getByRole('tab', { name: 'Windows' })).toBeFocused();
  await page.getByRole('button', { name: 'Wave to Tavi' }).click();
  await page.screenshot({ path: `${output}/desktop.png`, fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: `${output}/mobile.png`, fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.getByRole('button', { name: 'Wave to Tavi' })).toBeVisible();
  fullRelease = false;
  await page.reload();
  await page.getByRole('tab', { name: 'macOS' }).click();
  await expect(page.getByText('macOS installers are coming soon.')).toBeVisible();
  status = 404;
  await page.reload();
  await expect(page.getByText('Windows installers are coming soon.')).toBeVisible();
  status = 503;
  await page.reload();
  await expect(page.getByText('Could not check installers. View releases below.')).toBeVisible();
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
    'PASS standalone download, drawn character, greeting, Windows/macOS/Linux installer links, keyboard tabs, partial releases, preview link, missing/error release states, mobile layout, original landing copy, no browser errors.',
  );
} finally {
  await browser.close();
}
