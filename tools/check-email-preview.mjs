import { chromium, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
const browser = await chromium.launch({ headless: true });
try {
  await mkdir('.data/email-previews/review', { recursive: true });
  const page = await browser.newPage();
  for (const width of [700, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const kind of [
      'confirmation',
      'welcome',
      'release',
      'invite-says-it',
      'invite-for-chat',
      'invite-chat-talks',
      'invite-from-the-maker',
      'invite-plain-note',
    ]) {
      await page.goto(`http://127.0.0.1:4180/${kind}`);
      // The plain note is a letter with no pictures.
      await expect(page.locator('img')).toHaveCount(kind === 'invite-plain-note' ? 0 : 4);
      expect(
        await page
          .locator('img')
          .evaluateAll((images) => images.every((img) => img.complete && img.naturalWidth > 0)),
      ).toBe(true);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      await expect(page.getByRole('link', { name: 'Unsubscribe', exact: true })).toBeVisible();
      await page.screenshot({
        path: `.data/email-previews/review/${kind}-${width}.png`,
        fullPage: true,
      });
    }
  }
  console.log('All email designs passed image, mobile width, and unsubscribe-link checks.');
} finally {
  await browser.close();
}
