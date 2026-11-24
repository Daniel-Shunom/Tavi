// Walks the new Studio (/studio-next) in a real browser: the first-launch welcome, then the stage
// on later launches; the three modes, Settings, the Rehearse drawer, "Jump to anything" and a
// narrow window. It changes nothing that is saved except quiet mode, which it puts back.
// Run with the dev servers up: node tools/studio-next-check.mjs
import { chromium, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const base = process.env.TAVI_TEST_URL ?? 'http://127.0.0.1:5173';
const browser = await chromium.launch({ headless: true });
const errors = [];
await mkdir('test-results', { recursive: true });
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  const shot = (name) => page.screenshot({ path: `test-results/studio-next-${name}.png` });
  // Where the named pieces sit, to the pixel. Nothing should move or change size when a step,
  // mode or panel changes, including while a panel is still sliding in.
  const place = (selectors) =>
    page.evaluate(
      (list) =>
        list.map((selector) => {
          const box = document.querySelector(selector)?.getBoundingClientRect();
          return box ? [box.x, box.y, box.width, box.height].map(Math.round).join(',') : 'missing';
        }),
      selectors,
    );
  const holdsStill = async (what, selectors, before) => {
    const after = await place(selectors);
    selectors.forEach((selector, i) => {
      if (after[i] !== before[i])
        errors.push(`${what}: ${selector} moved from ${before[i]} to ${after[i]}`);
    });
  };
  const wizardPieces = ['.sn-wz-figure', '.sn-stepper', '.sn-wz-foot'];
  const stagePieces = ['.sn-top', '.sn-scene', '.sn-deck', '.sn-inspector'];

  // First launch: the welcome, one step at a time, with her beside each.
  await page.goto(`${base}/studio-next?holiday=none`);
  await expect(page.getByRole('heading', { name: 'Meet your stream companion' })).toBeVisible();
  await expect(page.locator('.sn-wz-figure canvas').first()).toBeVisible({ timeout: 15000 });
  await page.waitForTimeout(2500);
  await shot('welcome');
  const wizardAt = await place(wizardPieces);
  await page.getByRole('button', { name: 'Get started' }).click();
  await expect(page.getByRole('heading', { name: 'Say hello' })).toBeVisible();
  await expect(page.getByLabel('Her name')).toBeEnabled({ timeout: 10000 });
  await page.waitForTimeout(500);
  await shot('welcome-hello');
  await holdsStill('Welcome, say hello', wizardPieces, wizardAt);
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('heading', { name: 'Invite her onto your stream' })).toBeVisible();
  await page.waitForTimeout(500);
  await shot('welcome-obs');
  await holdsStill('Welcome, OBS', wizardPieces, wizardAt);
  await page.getByRole('button', { name: 'I’ll do this later' }).click();
  await expect(page.getByRole('heading', { name: 'Introduce her to chat' })).toBeVisible();
  await page.waitForTimeout(800);
  await shot('welcome-chat');
  await holdsStill('Welcome, chat', wizardPieces, wizardAt);
  await page.getByRole('button', { name: 'Skip for now' }).click();
  await expect(page.getByRole('heading', { name: /is here$/ })).toBeVisible();
  await page.waitForTimeout(1200);
  await shot('welcome-done');
  await holdsStill('Welcome, done', wizardPieces, wizardAt);
  await page.getByRole('button', { name: 'Open the stage' }).click();

  // The stage, and every later launch.
  const modes = page.getByRole('tablist', { name: 'What you are working on' });
  await expect(modes.getByRole('tab', { name: 'Live' })).toHaveAttribute('aria-selected', 'true');
  await page.goto(`${base}/studio-next?holiday=none`);
  await page.reload();
  await expect(modes.getByRole('tab', { name: 'Live' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('.sn-scene canvas').first()).toBeVisible({ timeout: 15000 });
  await page.waitForTimeout(2500);
  await shot('stage-live');
  const stageAt = await place(stagePieces);
  // The visual system's alignment, measured: reaction discs share one top edge and labels one
  // bottom edge, and the tabs sit on the window's centre line.
  const aligned = await page.evaluate(() => {
    const edges = (selector, edge) => [
      ...new Set(
        [...document.querySelectorAll(selector)].map((el) =>
          Math.round(el.getBoundingClientRect()[edge]),
        ),
      ),
    ];
    const tabs = document.querySelector('.sn-top .sn-tabs').getBoundingClientRect();
    return {
      discTops: edges('.sn-deck .sn-key svg', 'top'),
      labelBottoms: edges('.sn-deck .sn-key > span', 'bottom'),
      capTops: edges('.sn-deck .sn-key kbd', 'top'),
      tabsOffCentre: Math.abs(tabs.left + tabs.width / 2 - innerWidth / 2),
      sideGap: document.querySelector('.sn-top-side').getBoundingClientRect().left - tabs.right,
      brandGap: tabs.left - document.querySelector('.sn-top-brand').getBoundingClientRect().right,
    };
  });
  if (aligned.discTops.length !== 1)
    errors.push(`Reaction discs are at different heights: ${aligned.discTops.join(', ')}`);
  if (aligned.labelBottoms.length !== 1)
    errors.push(`Reaction labels end at different heights: ${aligned.labelBottoms.join(', ')}`);
  if (aligned.capTops.length !== 1)
    errors.push(`Key caps are at different heights: ${aligned.capTops.join(', ')}`);
  if (aligned.sideGap < 8 || aligned.brandGap < 8)
    errors.push(
      `The top bar's sides crowd the tabs (gaps ${String(aligned.brandGap)}px and ${String(aligned.sideGap)}px)`,
    );
  if (aligned.tabsOffCentre > 1)
    errors.push(`The tabs are ${String(aligned.tabsOffCentre)}px off the window's centre`);
  // The OBS step was left for later, so the stage offers to finish it.
  await expect(page.getByRole('button', { name: 'Finish setup · 2 of 3' })).toBeVisible();

  // Settings: a panel over the stage.
  await page.getByRole('button', { name: 'Settings' }).click();
  const settings = page.getByRole('dialog', { name: 'Settings' });
  await expect(settings.getByRole('heading', { name: 'Connections' })).toBeVisible();
  await page.waitForTimeout(500);
  await shot('settings-connections');
  for (const section of ['Stream layout', 'Preferences']) {
    await settings.getByRole('tab', { name: section }).click();
    await expect(settings.getByRole('heading', { name: section })).toBeVisible();
    await page.waitForTimeout(400);
    await shot(`settings-${section.toLowerCase().replace(' ', '-')}`);
  }
  // Themes: Honey by default; each scheme has a light and a dark tone.
  const studio = page.locator('.studio.sn');
  await expect(studio).toHaveAttribute('data-theme', 'honey');
  await settings.getByRole('radio', { name: 'Dark' }).click();
  await expect(studio).toHaveAttribute('data-tone', 'dark');
  for (const scheme of ['Sorbet', 'Macaron', 'Lagoon', 'Arcade', 'Matcha', 'Soda', 'Honey']) {
    await settings.getByRole('combobox', { name: 'Colours' }).click();
    await page.getByRole('option', { name: new RegExp(`^${scheme}`) }).click();
    await expect(studio).toHaveAttribute('data-theme', scheme.toLowerCase());
    await page.getByRole('button', { name: 'Close Settings' }).click();
    await page.waitForTimeout(350);
    await shot(`theme-${scheme.toLowerCase()}-dark`);
    await page.getByRole('button', { name: 'Settings' }).click();
    await settings.getByRole('tab', { name: 'Preferences' }).click();
    await settings.getByRole('radio', { name: 'Light' }).click();
    await page.getByRole('button', { name: 'Close Settings' }).click();
    await page.waitForTimeout(350);
    await shot(`theme-${scheme.toLowerCase()}-light`);
    await page.getByRole('button', { name: 'Settings' }).click();
    await settings.getByRole('tab', { name: 'Preferences' }).click();
    if (scheme !== 'Honey') await settings.getByRole('radio', { name: 'Dark' }).click();
  }
  await page.waitForTimeout(300);
  await shot('settings-theme');
  await page.getByRole('button', { name: 'Close Settings' }).click();
  await expect(settings).toBeHidden();

  // Out of season no holiday theme is on offer.
  await page.getByRole('button', { name: 'Settings' }).click();
  await settings.getByRole('tab', { name: 'Preferences' }).click();
  await settings.getByRole('combobox', { name: 'Colours' }).click();
  await expect(page.locator('.sn-select-item')).toHaveCount(7);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Close Settings' }).click();

  // In a holiday's season its theme arrives by itself: her room, a ninth key and a countdown,
  // and nothing on the stage moves to make room.
  await page.goto(`${base}/studio-next?holiday=christmas`);
  await expect(studio).toHaveAttribute('data-theme', 'christmas');
  await expect(page.locator('.sn-room-back')).toBeVisible();
  await expect(page.locator('.sn-room-front img').first()).toBeVisible();
  await expect(page.getByRole('button', { name: /Festive cheer/ })).toBeVisible();
  await expect(page.getByText(/to Christmas|Christmas theme/).first()).toBeVisible();
  await page.waitForTimeout(1500);
  await holdsStill('Christmas theme', stagePieces, stageAt);
  await shot('holiday-christmas');
  const room = page.getByRole('switch', { name: /Decorate her room/ });
  await room.click();
  await expect(page.locator('.sn-room-back')).toHaveCount(0);
  await holdsStill('Room switched off', stagePieces, stageAt);
  await room.click();
  await expect(page.locator('.sn-room-back')).toBeVisible();
  // It is the only holiday on offer, and the streamer can swap out of it and back.
  await page.getByRole('button', { name: 'Settings' }).click();
  await settings.getByRole('tab', { name: 'Preferences' }).click();
  await settings.getByRole('combobox', { name: 'Colours' }).click();
  await expect(page.locator('.sn-select-item')).toHaveCount(8);
  await expect(page.getByRole('option', { name: /^Halloween/ })).toHaveCount(0);
  await page.getByRole('option', { name: /^Lagoon/ }).click();
  await expect(studio).toHaveAttribute('data-theme', 'lagoon');
  // A reload keeps both the choice and the open Settings section (the address remembers it).
  await page.reload();
  await expect(studio).toHaveAttribute('data-theme', 'lagoon');
  await expect(settings.getByRole('heading', { name: 'Preferences' })).toBeVisible();
  await settings.getByRole('combobox', { name: 'Colours' }).click();
  await page.getByRole('option', { name: /^Christmas/ }).click();
  await expect(studio).toHaveAttribute('data-theme', 'christmas');
  await settings.getByRole('combobox', { name: 'Colours' }).click();
  await page.getByRole('option', { name: /^Honey/ }).click();
  await page.getByRole('button', { name: 'Close Settings' }).click();
  await page.goto(`${base}/studio-next?holiday=none`);
  await expect(studio).toHaveAttribute('data-theme', 'honey');

  // Quiet mode flips at once, and back.
  const quiet = page.getByRole('switch', { name: /Quiet mode/ });
  const before = await quiet.getAttribute('aria-checked');
  await quiet.click();
  await expect(quiet).not.toHaveAttribute('aria-checked', before ?? 'false');
  await quiet.click();
  await expect(quiet).toHaveAttribute('aria-checked', before ?? 'false');

  await page.getByRole('button', { name: 'Rehearse' }).click();
  for (const wait of [40, 80, 120, 200]) {
    await page.waitForTimeout(wait);
    await holdsStill('Opening Rehearse', stagePieces, stageAt);
  }
  await expect(page.getByRole('dialog', { name: 'Rehearse' })).toBeVisible();
  await page.waitForTimeout(500);
  await shot('stage-rehearse');
  await page.getByRole('button', { name: 'Close Rehearse' }).click();
  await expect(page.getByRole('dialog', { name: 'Rehearse' })).toBeHidden();

  await modes.getByRole('tab', { name: 'Look' }).click();
  await expect(page.getByLabel('Her name')).toBeVisible();
  await page.waitForTimeout(2500);
  await shot('stage-look');
  await holdsStill('Look mode', stagePieces, stageAt);

  await modes.getByRole('tab', { name: 'Personality' }).click();
  await expect(page.getByRole('radiogroup', { name: 'Her nature' })).toBeVisible();
  await page.waitForTimeout(600);
  await shot('stage-personality');
  await holdsStill('Personality mode', stagePieces, stageAt);

  // Jump to anything: search, then Enter.
  await page.keyboard.press('Control+k');
  const search = page.getByRole('combobox', { name: 'Search places and actions' });
  await expect(search).toBeFocused();
  await page.waitForTimeout(300);
  await shot('palette');
  await search.fill('preferences');
  await page.keyboard.press('Enter');
  await expect(settings.getByRole('heading', { name: 'Preferences' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(settings).toBeHidden();
  await modes.getByRole('tab', { name: 'Live' }).click();

  // A narrow window: nothing scrolls sideways.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(600);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  if (overflow > 1) errors.push(`Narrow stage scrolls sideways by ${String(overflow)}px`);
  await shot('stage-narrow');

  if (errors.length) throw new Error(`Browser errors:\n${errors.join('\n')}`);
  console.log('New Studio check passed. Screenshots are in test-results/.');
} finally {
  await browser.close();
}
