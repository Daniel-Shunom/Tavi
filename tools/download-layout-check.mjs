import { chromium, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
const base = process.env.TAVI_TEST_URL ?? 'http://127.0.0.1:4322';
const browser = await chromium.launch({ headless: true });
const assets = [
  'Tavi.Studio_0.1.1_x64-setup.exe',
  'Tavi.Studio_0.1.1_aarch64.dmg',
  'Tavi.Studio_0.1.1_x64.dmg',
  'Tavi.Studio_0.1.1_amd64.deb',
  'Tavi.Studio_0.1.1_amd64.AppImage',
].map((name) => ({
  name,
  browser_download_url: 'https://github.com/Daniel-Shunom/Tavi/releases/download/v0.1.1/' + name,
}));
await mkdir('test-results/post-hackathon', { recursive: true });
const failures = [];
try {
  for (const width of [1440, 1024, 768, 390, 320]) {
    const context = await browser.newContext({
      viewport: { width, height: 900 },
      reducedMotion: 'reduce',
    });
    const page = await context.newPage();
    let releaseLookup;
    const lookupReady = new Promise((resolve) => {
      releaseLookup = resolve;
    });
    await page.route(
      'https://api.github.com/repos/Daniel-Shunom/Tavi/releases/latest',
      async (route) => {
        await lookupReady;
        await route.fulfill({ json: { assets } });
      },
    );
    await page.goto(base + '/download');
    await page.evaluate(() => document.fonts.ready);
    await expect(
      page.getByRole('tabpanel').getByText('Checking for the latest installer…', { exact: true }),
    ).toBeVisible();
    const baseline = await page.evaluate(() =>
      Object.fromEntries(
        [
          '.download-layout',
          '#download-heading',
          '.download-platforms',
          '.download-stage',
          '.download-footer',
        ].map((selector) => {
          const rect = document.querySelector(selector).getBoundingClientRect();
          return [
            selector,
            { x: rect.x, y: rect.y + scrollY, width: rect.width, height: rect.height },
          ];
        }),
      ),
    );
    releaseLookup();
    await expect(page.getByRole('link', { name: /Download for/ }).first()).toBeVisible();
    for (const name of ['Windows', 'macOS', 'Linux', 'Windows']) {
      await page.getByRole('tab', { name, exact: true }).click();
      await expect(page.getByRole('tabpanel')).toHaveCount(1);
      await expect(page.getByRole('tabpanel')).toHaveAttribute(
        'aria-labelledby',
        name === 'Windows'
          ? 'download-tab-windows'
          : name === 'macOS'
            ? 'download-tab-macos'
            : 'download-tab-linux',
      );
      const boxes = await page.evaluate(() =>
        Object.fromEntries(
          [
            '.download-layout',
            '#download-heading',
            '.download-platforms',
            '.download-stage',
            '.download-footer',
          ].map((selector) => {
            const rect = document.querySelector(selector).getBoundingClientRect();
            return [
              selector,
              { x: rect.x, y: rect.y + scrollY, width: rect.width, height: rect.height },
            ];
          }),
        ),
      );
      const moved = Object.keys(boxes).filter((selector) =>
        Object.keys(boxes[selector]).some(
          (key) => Math.abs(boxes[selector][key] - baseline[selector][key]) > 1,
        ),
      );
      console.log(JSON.stringify({ width, platform: name, moved }));
      if (moved.length) failures.push(`${width}px ${name}: ${moved.join(', ')} resized or moved`);
      if (name !== 'Windows' || !baseline)
        await page.screenshot({
          path: `test-results/post-hackathon/download-${width}-${name}.png`,
          fullPage: true,
        });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
    }
    await page.getByRole('tab', { name: 'Windows', exact: true }).focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('tab', { name: 'macOS', exact: true })).toBeFocused();
    await page.keyboard.press('End');
    await expect(page.getByRole('tab', { name: 'Linux', exact: true })).toBeFocused();
    await page.keyboard.press('Home');
    await expect(page.getByRole('tab', { name: 'Windows', exact: true })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(
      page.getByRole('link', { name: 'Download for Windows', exact: true }),
    ).toBeFocused();
    await context.close();
  }
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion: 'reduce',
  });
  const page = await context.newPage();
  const errors = [];
  const eventLogos = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => {
    if (/twitch-glitch|codex/i.test(request.url())) eventLogos.push(request.url());
  });
  await page.goto(base);
  await expect(page.locator('.page-walker')).toHaveAttribute('data-tavi-ready', 'true');
  await expect
    .poll(() =>
      page.locator('.crt-dither-on').evaluate((canvas) =>
        canvas
          .getContext('2d')
          .getImageData(0, 0, canvas.width, canvas.height)
          .data.some((value) => value > 0),
      ),
    )
    .toBe(true);
  await page.screenshot({ path: 'test-results/post-hackathon/landing-hero.png' });
  await page.locator('.closing-scene').scrollIntoViewIfNeeded();
  await expect
    .poll(() =>
      page.locator('.closing-dither').evaluate((canvas) =>
        canvas
          .getContext('2d')
          .getImageData(0, 0, canvas.width, canvas.height)
          .data.some((value) => value > 0),
      ),
    )
    .toBe(true);
  await page.screenshot({ path: 'test-results/post-hackathon/landing-closing.png' });
  expect(eventLogos).toEqual([]);
  expect(errors).toEqual([]);
  await context.close();
} finally {
  await browser.close();
}
if (failures.length) throw new Error(failures.join('\n'));
console.log(
  'Download layout stays stable across platform switches at desktop, tablet and mobile widths.',
);
