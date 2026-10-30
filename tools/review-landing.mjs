import { chromium, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: 'reduce',
  });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('http://127.0.0.1:4321/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('h1')).toBeVisible();
  await expect(page.locator('[data-character-id="tavi-refined"]').first()).toBeAttached({
    timeout: 30000,
  });
  await mkdir('.data/landing-review', { recursive: true });
  await page.screenshot({ path: '.data/landing-review/desktop.png', fullPage: true });
  await page.getByRole('button', { name: 'Watch the product demo' }).click();
  await expect(page.locator('.stream-stage')).toHaveClass(/is-stream-started/);
  const tabs = page.getByRole('tab');
  await tabs.nth(1).click();
  await expect(tabs.nth(1)).toHaveAttribute('aria-selected', 'true');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('http://127.0.0.1:4321/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('h1')).toBeVisible();
  await page.screenshot({ path: '.data/landing-review/mobile.png', fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
  console.log(
    'Landing desktop/mobile, demo replay, Studio tabs, and reduced-motion checks passed.',
  );
} finally {
  await browser.close();
}
