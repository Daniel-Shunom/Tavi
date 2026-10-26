// Screenshot of the overlay feet and contact shadow, to confirm the soles touch the floor.
// Usage: TAVI_TEST_URL=http://127.0.0.1:5173 node tools/grounding-shot.mjs
import { chromium, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
const base = process.env.TAVI_TEST_URL ?? 'http://127.0.0.1:5173';
const browser = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader'] });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto(base + '/overlay');
  await expect(page.locator('.avatar-renderer')).toHaveAttribute('data-ready', 'true', {
    timeout: 30000,
  });
  await page.waitForTimeout(3000);
  const box = await page.locator('.avatar-shadow').boundingBox();
  if (!box) throw new Error('No contact shadow');
  await mkdir('test-results', { recursive: true });
  await page.screenshot({
    path: 'test-results/grounding.png',
    clip: { x: box.x - 60, y: box.y - 120, width: box.width + 120, height: 160 },
  });
  console.log('Shadow box', JSON.stringify(box));
} finally {
  await browser.close();
}
