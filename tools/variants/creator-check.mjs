// Browser check for the character creator: switches to a character with a variant rig, picks
// presets and individual options, and screenshots the creator, the studio stage and the OBS
// overlay (which must show the same variant) into test-results/variants/creator/.
// Usage: run the service (npm run build, then TAVI_PORT=4391 npx tsx server/index.ts) and
//   TAVI_TEST_URL=http://127.0.0.1:4391 node tools/variants/creator-check.mjs
import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const base = process.env.TAVI_TEST_URL ?? 'http://127.0.0.1:4318';
const out = 'test-results/variants/creator';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const errors = [];
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
page.on('pageerror', (e) => errors.push('studio: ' + e.message));
page.on('console', (m) => m.type() === 'error' && errors.push('studio: ' + m.text()));
await page.goto(base + '/studio#look');
await page.waitForSelector('#look-panel');
const useButton = page.locator('#look-panel button', { hasText: /^Use / });
if (await useButton.count()) await useButton.click();
await page.waitForSelector('.creator-preset');
const settle = () => page.waitForTimeout(2500);

const overlay = await browser.newPage({ viewport: { width: 1280, height: 720 } });
overlay.on('pageerror', (e) => errors.push('overlay: ' + e.message));
overlay.on('console', (m) => m.type() === 'error' && errors.push('overlay: ' + m.text()));
await overlay.goto(base + '/overlay');

const steps = [
  ['preset-locs', async () => page.locator('.creator-preset', { hasText: 'Locs' }).first().click()],
  ['skin-tone-3', async () => page.getByRole('radio', { name: 'Tone 3', exact: true }).click()],
  [
    'hair-afro',
    async () => {
      await page.getByRole('tab', { name: 'Hair' }).click();
      await page.getByRole('radio', { name: 'Coily afro', exact: true }).click();
    },
  ],
  [
    'build-broad',
    async () => {
      await page.getByRole('tab', { name: 'Body' }).click();
      await page
        .getByRole('radiogroup', { name: 'Build' })
        .getByRole('radio', { name: 'Broad' })
        .click();
    },
  ],
  [
    'hearing-aids',
    async () => {
      await page.getByRole('tab', { name: 'Details' }).click();
      await page
        .getByRole('radiogroup', { name: 'Hearing aids' })
        .getByRole('radio', { name: 'Both' })
        .click();
    },
  ],
  [
    'covering-hijab',
    async () => {
      await page.getByRole('tab', { name: 'Hair' }).click();
      await page
        .getByRole('radiogroup', { name: 'Head covering' })
        .getByRole('radio', { name: 'Hijab' })
        .click();
    },
  ],
];
for (const [name, act] of steps) {
  await act();
  await settle();
  await page.locator('#look-panel').scrollIntoViewIfNeeded();
  await page.locator('#look-panel').screenshot({ path: `${out}/${name}-creator.png` });
  await page
    .locator('.avatar-renderer')
    .first()
    .screenshot({ path: `${out}/${name}-stage.png` });
  await overlay.screenshot({ path: `${out}/${name}-overlay.png` });
}
const saved = await page.evaluate(async () => (await fetch('/api/state')).ok);
console.log('screenshots ->', out, 'state endpoint ok:', saved);
const relevant = errors.filter((e) => !e.includes('Blank Script'));
console.log('errors:', relevant.length ? relevant : 'none');
await browser.close();
