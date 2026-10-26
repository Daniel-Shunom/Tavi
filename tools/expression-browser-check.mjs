// Exercises the expression system in a real browser: core reactions, captions, conversation
// pipeline, cancel, retract/restore choreography, studio/overlay agreement, and saves
// screenshots of each reaction to test-results/expressions/ for visual review.
// Usage: TAVI_TEST_URL=http://127.0.0.1:5173 node tools/expression-browser-check.mjs
import { chromium, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
const base = process.env.TAVI_TEST_URL ?? 'http://127.0.0.1:5173';
const browser = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader'] });
const errors = [];
const state = async (page) => await (await page.request.get(base + '/api/state')).json();
try {
  const context = await browser.newContext({ viewport: { width: 1400, height: 1000 } });
  const page = await context.newPage();
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(base);
  await expect(page.getByText('Local service connected')).toBeVisible();
  await expect(page.locator('.portrait-space .avatar-renderer')).toHaveAttribute(
    'data-ready',
    'true',
    { timeout: 30000 },
  );
  const overlay = await (
    await browser.newContext({ viewport: { width: 1280, height: 720 } })
  ).newPage();
  overlay.on('pageerror', (error) => errors.push(error.message));
  await overlay.goto(base + '/overlay');
  await expect(overlay.locator('.avatar-renderer')).toHaveAttribute('data-ready', 'true', {
    timeout: 30000,
  });
  await mkdir('test-results/expressions', { recursive: true });
  // Start from a visible companion regardless of earlier runs.
  const back = page.getByRole('button', { name: 'Bring Tavi back', exact: true });
  if (await back.count()) await back.click();
  await expect(page.getByRole('button', { name: 'Tuck away', exact: true })).toBeVisible();
  await page.waitForTimeout(2000);
  const dock = page.getByRole('group', { name: 'Try an expression' });
  const expected = {
    wave: ['glance', 'wave', 'content'],
    listen: ['listening'],
    'really?': ['skeptical', 'agreeing', 'sassy'],
    oops: ['startled', 'innocent', 'look-away', 'embarrassed'],
    nice: ['impressed', 'agreeing'],
    celebrate: ['startled', 'celebrate', 'proud'],
  };
  for (const [label, allowed] of Object.entries(expected)) {
    await dock.getByRole('button', { name: label, exact: true }).click();
    await page.waitForTimeout(1300);
    const performance = await page
      .locator('.portrait-space .avatar-renderer')
      .getAttribute('data-performance');
    if (!allowed.includes(performance))
      throw new Error(
        `${label}: unexpected ${performance}; service script: ${JSON.stringify((await state(page)).performance.script?.beats.map((value) => value.expression))}`,
      );
    // Studio and overlay render the same cue on the shared clock.
    const overlayPerformance = await overlay
      .locator('.avatar-renderer')
      .getAttribute('data-performance');
    if (!allowed.includes(overlayPerformance))
      throw new Error(`${label}: overlay shows ${overlayPerformance}`);
    await page
      .locator('.portrait-space')
      .screenshot({ path: `test-results/expressions/${label.replace('?', '')}.png` });
    await page.keyboard.press('Escape');
    await expect.poll(async () => (await state(page)).performance.script).toBeNull();
  }
  // Conversation: a typed line goes through the decision provider and shows a caption.
  await page.getByRole('link', { name: 'Playground', exact: true }).click();
  await page.getByLabel('Simulated message').fill('That was totally intentional.');
  await page.getByRole('button', { name: 'Say it', exact: true }).click();
  await expect
    .poll(async () => (await state(page)).performance.script?.decidedBy.label)
    .toBe('Rules (not AI)');
  await expect(page.locator('.portrait-space .avatar-caption')).toBeVisible();
  await page
    .locator('.portrait-space')
    .screenshot({ path: 'test-results/expressions/conversation.png' });
  await expect(page.locator('.ai-active')).toContainText('Rules (not AI)');
  await expect(page.locator('.ai-badge')).toHaveText('Not AI');
  // Retract and restore emit seeded choreography cues; retract interrupts immediately.
  await page.getByRole('button', { name: 'Tuck away', exact: true }).click();
  await expect.poll(async () => (await state(page)).performance.presence?.kind).toBe('exit');
  // The motion layer may exit by walking or climbing out rather than fading, so check state.
  await expect(page.locator('.portrait-space .avatar-renderer')).toHaveAttribute(
    'data-retracted',
    'true',
  );
  await page.getByRole('button', { name: 'Bring Tavi back', exact: true }).click();
  await expect.poll(async () => (await state(page)).performance.presence?.kind).toBe('enter');
  await expect(page.locator('.portrait-space .avatar-renderer')).toHaveAttribute(
    'data-retracted',
    'false',
  );
  await expect(page.locator('.portrait-space .avatar-body')).toHaveCSS('opacity', '1', {
    timeout: 15000,
  });
  // A reconnecting overlay shows current state without replaying finished cues.
  const fresh = await (
    await browser.newContext({ viewport: { width: 1280, height: 720 } })
  ).newPage();
  await fresh.goto(base + '/overlay');
  await expect(fresh.locator('.avatar-renderer')).toHaveAttribute('data-ready', 'true', {
    timeout: 30000,
  });
  await expect(fresh.locator('.avatar-renderer')).toHaveAttribute('data-performance', 'idle', {
    timeout: 8000,
  });
  // Wardrobe: equip an item, see it on stage, then remove it.
  await page.getByRole('link', { name: 'Wardrobe', exact: true }).click();
  await page.getByRole('radio', { name: 'Pom beanie' }).click();
  await expect
    .poll(async () => (await state(page)).config.wardrobe.attachments['head.top'])
    .toBe('beanie');
  await page.waitForTimeout(800);
  await page
    .locator('.portrait-space')
    .screenshot({ path: 'test-results/expressions/wardrobe.png' });
  await page.getByRole('radiogroup', { name: 'Hat' }).getByRole('radio', { name: 'None' }).click();
  await expect
    .poll(async () => (await state(page)).config.wardrobe.attachments['head.top'])
    .toBeUndefined();
  if (errors.length) throw new Error(errors.join('\n'));
  console.log(
    'Expression browser checks passed: six core reactions, studio/overlay agreement, cancel, conversation caption, provider label, retract/restore choreography, reconnect without replay.',
  );
} finally {
  await browser.close();
}
