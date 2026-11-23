import { chromium, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const base = process.env.TAVI_TEST_URL ?? 'http://127.0.0.1:4322';
const browser = await chromium.launch({ headless: true });
const releaseAssets = [
  'Tavi_x64-setup.exe',
  'Tavi_aarch64.dmg',
  'Tavi_x64.dmg',
  'Tavi_amd64.deb',
  'Tavi_amd64.AppImage',
].map((name) => ({ name, browser_download_url: `https://example.com/${name}` }));
await mkdir('test-results/post-hackathon', { recursive: true });

try {
  for (const reducedMotion of ['no-preference', 'reduce']) {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      reducedMotion,
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.route('https://api.github.com/repos/Daniel-Shunom/Tavi/releases/latest', (route) =>
      route.fulfill({ json: { assets: releaseAssets } }),
    );
    await page.goto(base + '/download');
    await expect(page.getByRole('link', { name: /Download/ }).first()).toBeVisible();
    await page.getByRole('tab', { name: 'Windows', exact: true }).click();
    const panel = page.getByRole('tabpanel');
    // Pause inside the browser on the first frame, so slow tool round trips
    // cannot let this short transition finish before it is sampled.
    const sample = await page.evaluate(async () => {
      document.querySelector('#download-tab-macos').click();
      await new Promise(requestAnimationFrame);
      const node = document.querySelector('#download-panel-macos');
      const duration = getComputedStyle(node).transitionDuration;
      for (const animation of node.getAnimations()) {
        animation.pause();
        animation.currentTime = 100;
      }
      return {
        duration,
        opacity: Number(getComputedStyle(node).opacity),
        transform: getComputedStyle(node).transform,
        indicatorDuration: getComputedStyle(
          document.querySelector('#download-tab-macos'),
          '::after',
        ).transitionDuration,
      };
    });
    const transitions = sample.duration;
    if (reducedMotion === 'reduce') {
      expect(transitions).toBe('0s');
      expect(await panel.evaluate((node) => getComputedStyle(node).transform)).toBe('none');
    } else {
      expect(transitions).toBe('0s');
      expect(sample.opacity).toBe(1);
      expect(sample.transform).toBe('none');
      expect(sample.indicatorDuration).toBe('0.2s');
      await page.screenshot({
        path: 'test-results/post-hackathon/download-transition-midpoint.png',
      });
    }
    await page.getByRole('tab', { name: 'Linux', exact: true }).click();
    await page.getByRole('tab', { name: 'Windows', exact: true }).click();
    await expect(
      page.getByRole('link', { name: 'Download for Windows', exact: true }),
    ).toBeVisible();
    await page.getByRole('tab', { name: 'Windows', exact: true }).focus();
    await page.keyboard.press('End');
    expect(await panel.evaluate((node) => getComputedStyle(node).transitionDuration)).toBe('0s');
    await expect(page.getByRole('tab', { name: 'Linux', exact: true })).toBeFocused();

    await page.goto(base);
    await page.locator('#studio').scrollIntoViewIfNeeded();
    const shape = page.getByRole('tab', { name: /Shape her/ });
    await shape.focus();
    await page.keyboard.press('ArrowRight');
    const energy = page.getByRole('tab', { name: /Set her energy/ });
    await expect(energy).toBeFocused();
    expect(await energy.evaluate((node) => getComputedStyle(node).transitionDuration)).toBe('0s');
    // A reader focusing a step must not have the selection change underneath them.
    await page.waitForTimeout(3800);
    await expect(energy).toHaveAttribute('aria-selected', 'true');
    expect(errors).toEqual([]);
    await context.close();
    console.log(
      `PASS ${reducedMotion}: tab contents stay still, indicator feedback, instant keyboard tabs, stable focused preview.`,
    );
  }

  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    reducedMotion: 'reduce',
  });
  const page = await context.newPage();
  await page.goto(base);
  const knob = page.getByRole('button', { name: /channel/i });
  await knob.scrollIntoViewIfNeeded();
  const hitArea = await knob.evaluate((node) => {
    const style = getComputedStyle(node, '::after');
    return { width: parseFloat(style.width), height: parseFloat(style.height) };
  });
  expect(hitArea.width).toBeGreaterThanOrEqual(44);
  expect(hitArea.height).toBeGreaterThanOrEqual(44);
  // Hit the expanded area beyond the small illustrated knob itself.
  const box = await knob.boundingBox();
  expect(
    await knob.evaluate(
      (node, point) => {
        const target = document.elementFromPoint(point.x, point.y);
        return target === node || node.contains(target);
      },
      { x: box.x + box.width / 2 - 19, y: box.y + box.height / 2 },
    ),
  ).toBe(true);
  if (await page.locator('.mailing-list-signup').count()) {
    await page.locator('.mailing-list-consent').scrollIntoViewIfNeeded();
    expect(
      (await page.locator('.mailing-list-consent').boundingBox()).height,
    ).toBeGreaterThanOrEqual(44);
  } else {
    await expect(
      page.getByText('Signups are temporarily unavailable.', { exact: true }),
    ).toHaveCount(0);
  }
  await page.screenshot({ path: 'test-results/post-hackathon/landing-touch-targets.png' });
  await context.close();
  console.log('PASS mobile: expanded TV dial hit area; no unavailable-signup message.');
  for (const status of [200, 404, 503]) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    let release;
    const held = new Promise((resolve) => {
      release = resolve;
    });
    await page.route(
      'https://api.github.com/repos/Daniel-Shunom/Tavi/releases/latest',
      async (route) => {
        await held;
        await route.fulfill({ status, json: status === 200 ? { assets: releaseAssets } : {} });
      },
    );
    await page.goto(base + '/download');
    await page.evaluate(() => document.fonts.ready);
    const footer = await page
      .locator('.download-footer')
      .evaluate((node) => node.getBoundingClientRect().top + scrollY);
    // Keep a slow read pending long enough to see its real initial layout.
    await page.waitForTimeout(1100);
    await page.evaluate(() => {
      const panels = document.querySelector('.download-panels');
      const observer = new MutationObserver(() => {
        if (panels.dataset.ready !== 'true') return;
        const node = panels.querySelector('[aria-hidden="false"] .download-web-link');
        getComputedStyle(node).opacity;
        for (const animation of node.getAnimations()) {
          animation.pause();
          animation.currentTime = 100;
        }
        observer.disconnect();
      });
      observer.observe(panels, { attributes: true, attributeFilter: ['data-ready'] });
    });
    release();
    await expect(page.locator('.download-panels')).toHaveAttribute('data-ready', 'true');
    const preview = page.getByRole('tabpanel').locator('.download-web-link');
    const opacity = Number(await preview.evaluate((node) => getComputedStyle(node).opacity));
    expect(opacity).toBeGreaterThan(0);
    expect(opacity).toBeLessThan(1);
    expect(
      Math.abs(
        (await page
          .locator('.download-footer')
          .evaluate((node) => node.getBoundingClientRect().top + scrollY)) - footer,
      ),
    ).toBeLessThan(1);
    if (status !== 200) {
      await expect(page.getByRole('link', { name: 'View releases', exact: true })).toHaveAttribute(
        'href',
        'https://github.com/Daniel-Shunom/Tavi/releases',
      );
    }
    await context.close();
    console.log(`PASS slow lookup ${status}: stable layout and a fading browser link.`);
  }
} finally {
  await browser.close();
}
