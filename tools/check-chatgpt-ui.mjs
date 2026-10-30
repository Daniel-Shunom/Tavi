import { chromium, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://127.0.0.1:4318/studio#brain', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('button', { name: 'Continue with ChatGPT', exact: true })).toBeVisible({ timeout: 20000 });
  await expect(page.getByRole('button', { name: 'Continue with ChatGPT', exact: true })).toBeEnabled();
  await expect(page.getByText('Power Tavi with your ChatGPT plan.', { exact: true })).toBeVisible();
  await mkdir('.impeccable/review/chatgpt', { recursive: true });
  await page.screenshot({ path: '.impeccable/review/chatgpt/desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('button', { name: 'Continue with ChatGPT', exact: true })).toBeVisible();
  await page.screenshot({ path: '.impeccable/review/chatgpt/mobile.png', fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
  console.log('ChatGPT account controls: desktop/mobile passed. No authorization was started.');
} finally { await browser.close(); }
