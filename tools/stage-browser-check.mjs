import { chromium, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({
    viewport: { width: 1512, height: 1000 },
    reducedMotion: 'reduce',
  });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('http://127.0.0.1:5173');
  await expect(page.getByText('Local service connected', { exact: true })).toBeVisible();
  await expect(page.locator('canvas')).toBeVisible();
  await page.getByRole('button', { name: 'Daydream', exact: true }).click();
  await expect(page.locator('.companion-stage')).toHaveAttribute('data-lighting', 'daydream');
  await page.getByRole('button', { name: 'Moonlight', exact: true }).click();
  const before = await page.locator('.portrait-space').boundingBox();
  await page.getByRole('link', { name: 'Stream setup', exact: true }).click();
  await expect(page.locator('.overlay-url')).toBeInViewport();
  const after = await page.locator('.portrait-space').boundingBox();
  expect(after).toEqual(before);
  await page.getByRole('link', { name: 'Make it yours', exact: true }).click();
  await page.getByRole('tab', { name: 'Character', exact: true }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab', { name: 'Placement', exact: true })).toBeFocused();
  await page.keyboard.press('Home');
  await expect(page.getByRole('tab', { name: 'Character', exact: true })).toBeFocused();
  await mkdir('test-results', { recursive: true });
  await page.screenshot({ path: 'test-results/companion-stage-desktop.png' });
  for (const size of [
    { width: 1512, height: 1000 },
    { width: 1280, height: 720 },
    { width: 390, height: 844 },
    { width: 390, height: 640 },
  ]) {
    await page.setViewportSize(size);
    for (const expanded of [false, true]) {
      const button = page.getByRole('button', {
        name: expanded ? 'Give tools more room' : 'Give avatar more room',
        exact: true,
      });
      if (await button.count()) await button.click();
      await page.getByRole('link', { name: 'Playground', exact: true }).click();
      await page
        .getByRole('button', { name: 'Try reaction', exact: true })
        .scrollIntoViewIfNeeded();
      await expect(
        page.getByRole('button', { name: 'Try reaction', exact: true }),
      ).toBeInViewport();
      const bounds = await page.evaluate(() => {
        const stage = document.querySelector('.companion-stage').getBoundingClientRect();
        const deck = document.querySelector('.tool-deck').getBoundingClientRect();
        const portrait = document.querySelector('.portrait-space').getBoundingClientRect();
        return {
          stageWidth: stage.width,
          deckWidth: deck.width,
          viewportWidth: innerWidth,
          stageLeft: stage.left,
          stageBottom: stage.bottom,
          deckTop: deck.top,
          portraitTop: portrait.top,
          portraitBottom: portrait.bottom,
          height: stage.height,
          overflow: document.documentElement.scrollWidth > innerWidth,
        };
      });
      expect(bounds.overflow).toBe(false);
      expect(bounds.stageWidth).toBeLessThanOrEqual(bounds.viewportWidth);
      expect(bounds.deckWidth).toBeLessThanOrEqual(bounds.viewportWidth);
      expect(bounds.stageLeft).toBe(0);
      expect(bounds.stageBottom).toBeLessThanOrEqual(bounds.deckTop + 1);
      expect(bounds.portraitBottom).toBeLessThan(bounds.deckTop);
      expect(bounds.portraitTop).toBeGreaterThan(40);
      expect(bounds.height).toBeGreaterThan(170);
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
  const expand = page.getByRole('button', { name: 'Give avatar more room', exact: true });
  if (await expand.count()) await expand.click();
  await page.getByRole('link', { name: 'Make it yours', exact: true }).click();
  await page.screenshot({ path: 'test-results/companion-stage-mobile.png' });
  if (errors.length) throw new Error(errors.join('\n'));
  console.log(
    'Stage browser checks passed: lighting, reserved avatar space, tools scrolling, expanded tools, desktop/mobile/short-screen layouts.',
  );
} finally {
  await browser.close();
}
