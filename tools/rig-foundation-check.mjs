import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const base = process.env.TAVI_TEST_URL ?? 'http://127.0.0.1:5175';
await mkdir('test-results/rig-foundation', { recursive: true });
const browser = await chromium.launch({
  headless: true,
  args: ['--log-file=' + resolve('test-results/rig-foundation/chromium.log')],
});
const errors = [],
  measurements = [];
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(base + '/rig-lab');
  await expect(page.getByText('Comparison ready')).toBeVisible();
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  const canvases = page.locator('canvas');
  await expect(canvases).toHaveCount(2);
  for (const scene of process.env.TAVI_RIG_SCENES?.split(',') ?? [
    'Neutral',
    'Chest isolation',
    'Pelvis isolation',
    'Neck isolation',
    'Head stabilization',
    'Body flow',
    'Sleep',
    'Sleep settle',
    'Sleep cycle',
    'Wake interrupt',
    'Weight shift',
    'Support stress',
    'Turn',
    'Walk',
    'Floor sit',
    'Perch sit',
  ]) {
    await page.getByLabel('Study', { exact: true }).selectOption({ label: scene });
    await page
      .getByLabel('Strength', { exact: true })
      .fill(scene === 'Support stress' ? '1.5' : '1');
    let supportedHead = null;
    const times =
      scene === 'Sleep cycle'
        ? [0, 1, 2, 3.4, 4, 6, 8, 9.6, 10, 12, 15.9]
        : scene === 'Wake interrupt'
          ? [0, 1, 2, 2.7, 2.71, 3, 4, 7.9]
          : [0, 1, 2, 3.9, 6];
    for (const t of times) {
      await page.getByLabel('Pose time', { exact: true }).fill(String(t));
      await expect(page.getByText('Comparison ready')).toBeVisible();
      await expect(canvases.nth(1)).toHaveAttribute('data-sample-time', t.toFixed(4));
      const diagnostics = JSON.parse(await canvases.nth(1).getAttribute('data-rig-diagnostics'));
      measurements.push({ scene, time: t, ...diagnostics });
      if (scene === 'Sleep cycle' && (t === 3.4 || t === 9.6))
        await page.screenshot({
          path: `test-results/rig-foundation/sleep-contact-${String(t)}.png`,
        });
      if (
        (scene === 'Sleep' || scene === 'Sleep settle') &&
        diagnostics.sleepContacts.weight > 0.999
      ) {
        const anchor = diagnostics.sleepContacts.headAnchor;
        if (supportedHead)
          expect(
            Math.hypot(anchor[0] - supportedHead[0], anchor[1] - supportedHead[1]),
          ).toBeLessThan(0.02);
        else supportedHead = anchor;
        expect(diagnostics.sleepContacts.wristError).toBeLessThan(0.02);
        expect(diagnostics.sleepContacts.reachError).toBeLessThan(0.02);
      }
      if (diagnostics.sleepContacts.propWeight > 0.999)
        expect(diagnostics.sleepContacts.groundError).toBeLessThan(0.02);
      if (diagnostics.owner === 'contact-solver') {
        expect(diagnostics.contactError).toBeLessThan(0.02); // WASM stores float32 transforms.
        expect(diagnostics.lengthError).toBeLessThan(0.02);
        expect(diagnostics.supportResidual).toBeLessThan(0.02);
      }
    }
    await page.screenshot({
      path: `test-results/rig-foundation/${scene.toLowerCase().replaceAll(' ', '-')}.png`,
    });
  }
  // Exercise the same live instance: turning a control off must restore its
  // exact neutral pixels, not just produce the right pose after a reload.
  await page.getByLabel('Study', { exact: true }).selectOption('Neutral');
  await page.getByLabel('Pose time', { exact: true }).fill('2');
  await expect(page.getByText('Comparison ready')).toBeVisible();
  await expect(canvases.nth(1)).toHaveAttribute('data-sample-time', '2.0000');
  const neutral = await canvases.nth(1).screenshot();
  await writeFile('test-results/rig-foundation/neutral-before.png', neutral);
  for (const [label, key, value] of [
    ['Chest angle', 'chestTilt', 0.1],
    ['Pelvis angle', 'pelvisTilt', 0.06],
    ['Neck angle', 'neckTilt', 0.08],
    ['Head angle', 'headTilt', 0.15],
  ]) {
    await page.getByLabel(label, { exact: true }).fill(String(value));
    await expect
      .poll(
        async () =>
          JSON.parse(await canvases.nth(1).getAttribute('data-rig-diagnostics')).body[key],
      )
      .toBeCloseTo(value, 3);
  }
  await page.getByLabel('Steady head', { exact: true }).check();
  await page.getByRole('button', { name: 'Clear', exact: true }).click();
  await expect
    .poll(
      async () =>
        JSON.parse(await canvases.nth(1).getAttribute('data-rig-diagnostics')).body.chestTilt,
    )
    .toBe(0);
  const restored = await canvases.nth(1).screenshot();
  await writeFile('test-results/rig-foundation/neutral-restored.png', restored);
  const pixelError = await page.evaluate(
    async ([before, after]) => {
      async function decode(base64) {
        const blob = await (await fetch('data:image/png;base64,' + base64)).blob();
        const bitmap = await createImageBitmap(blob);
        const canvas = document.createElement('canvas');
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        const context = canvas.getContext('2d');
        if (!context) throw new Error('Missing pixel comparison context.');
        context.drawImage(bitmap, 0, 0);
        bitmap.close();
        return context.getImageData(0, 0, canvas.width, canvas.height).data;
      }
      const a = await decode(before),
        b = await decode(after);
      if (a.length !== b.length) throw new Error('Neutral image dimensions changed.');
      let maxDelta = 0,
        changedPixels = 0;
      for (let i = 0; i < a.length; i += 4) {
        let changed = false;
        for (let c = 0; c < 4; c++) {
          const delta = Math.abs(a[i + c] - b[i + c]);
          maxDelta = Math.max(maxDelta, delta);
          changed ||= delta > 0;
        }
        if (changed) changedPixels++;
      }
      return { maxDelta, changedPixels };
    },
    [neutral.toString('base64'), restored.toString('base64')],
  );
  // Observed GPU float32 edge rounding: one channel level in one antialiased pixel.
  expect(pixelError.maxDelta).toBeLessThanOrEqual(1);
  expect(pixelError.changedPixels).toBeLessThanOrEqual(4);
  await page.getByLabel('Pelvis angle', { exact: true }).fill('0.06');
  await page.getByLabel('Study', { exact: true }).selectOption('Walk');
  await expect(page.getByText('Comparison ready')).toBeVisible();
  await expect
    .poll(
      async () =>
        JSON.parse(await canvases.nth(1).getAttribute('data-rig-diagnostics')).body.pelvisTilt,
    )
    .toBe(0);
  await page.getByRole('button', { name: 'Clear', exact: true }).click();
  console.log(
    'Live controls restore neutral within GPU rounding tolerance; authored gait owns pelvis.',
  );
  await page.getByLabel('Scale', { exact: true }).selectOption('overlay');
  await page.getByLabel('Surface', { exact: true }).selectOption('checker');
  await page.screenshot({ path: 'test-results/rig-foundation/overlay-alpha.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/rig-foundation/mobile.png', fullPage: true });
  // Only touch a service explicitly supplied by the caller; never the user's live proxy.
  const service = process.env.TAVI_SERVICE_URL;
  if (service) {
    await page.setViewportSize({ width: 1440, height: 1100 });
    await page.goto(service + '/studio');
    const original = await (await page.request.get(service + '/api/state')).json();
    async function select(character) {
      await page.evaluate(
        (character) =>
          new Promise((resolve, reject) => {
            const socket = new WebSocket(`ws://${location.host}/ws`);
            let sent = false;
            const timeout = setTimeout(() => {
              socket.close();
              reject(new Error('Character selection timed out'));
            }, 10000);
            socket.onmessage = (event) => {
              const message = JSON.parse(event.data);
              if (message.type === 'error') {
                clearTimeout(timeout);
                socket.close();
                reject(new Error(message.message));
                return;
              }
              if (!sent) {
                sent = true;
                socket.send(JSON.stringify({ type: 'configure', patch: { character } }));
              } else if (message.state?.config.character === character) {
                clearTimeout(timeout);
                socket.close();
                resolve();
              }
            };
            socket.onerror = () => {
              clearTimeout(timeout);
              socket.close();
              reject(new Error('Character selection failed'));
            };
          }),
        character,
      );
    }
    try {
      await select('tavi-foundation');
      await expect(
        page.locator('canvas[data-character-id="tavi-foundation"]').first(),
      ).toBeVisible();
      const studioCanvas = page.locator('canvas[data-character-id="tavi-foundation"]').first();
      await page.getByRole('button', { name: /^stand$/i }).click();
      await page.getByRole('button', { name: /^nap$/i }).click();
      await expect
        .poll(
          async () =>
            JSON.parse(await studioCanvas.getAttribute('data-rig-diagnostics')).sleepContacts
              .weight,
          { timeout: 15000 },
        )
        .toBeGreaterThan(0.999);
      expect(
        JSON.parse(await studioCanvas.getAttribute('data-rig-diagnostics')).sleepContacts
          .wristError,
      ).toBeLessThan(0.02);
      await page.screenshot({ path: 'test-results/rig-foundation/studio.png' });
      const overlay = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
      overlay.on('pageerror', (e) => errors.push(e.message));
      await overlay.goto(service + '/overlay');
      await expect(overlay.locator('canvas[data-character-id="tavi-foundation"]')).toBeVisible();
      expect(
        await overlay.locator('body').evaluate((el) => getComputedStyle(el).backgroundColor),
      ).toBe('rgba(0, 0, 0, 0)');
      await expect
        .poll(
          async () =>
            JSON.parse(
              await overlay
                .locator('canvas[data-character-id="tavi-foundation"]')
                .getAttribute('data-rig-diagnostics'),
            ).sleepContacts.weight,
          { timeout: 15000 },
        )
        .toBeGreaterThan(0.999);
      await expect
        .poll(async () => {
          const a = JSON.parse(await studioCanvas.getAttribute('data-rig-diagnostics')).body;
          const b = JSON.parse(
            await overlay
              .locator('canvas[data-character-id="tavi-foundation"]')
              .getAttribute('data-rig-diagnostics'),
          ).body;
          return Math.abs(a.chestTilt - b.chestTilt);
        })
        .toBeLessThan(0.0005);
      await overlay.screenshot({
        path: 'test-results/rig-foundation/overlay.png',
        omitBackground: true,
      });
      await page.getByRole('button', { name: /^stand$/i }).click();
      await expect
        .poll(
          async () =>
            JSON.parse(await studioCanvas.getAttribute('data-rig-diagnostics')).sleepContacts
              .weight,
        )
        .toBeGreaterThan(0);
      await expect
        .poll(
          async () =>
            JSON.parse(await studioCanvas.getAttribute('data-rig-diagnostics')).sleepContacts
              .weight,
          { timeout: 15000 },
        )
        .toBe(0);
      await page.getByRole('button', { name: /^wave/i }).click();
      expect(
        JSON.parse(await studioCanvas.getAttribute('data-rig-diagnostics')).sleepContacts.weight,
      ).toBe(0);
      console.log(
        'Live Studio nap, overlay reconnect, wake release and post-wake gesture verified.',
      );
      await overlay.close();
    } finally {
      await select(original.config.character);
    }
    console.log('Built Studio and transparent overlay both rendered Tavi foundation.');
  }
  expect(errors).toEqual([]);
  await writeFile(
    'test-results/rig-foundation/measurements.json',
    JSON.stringify(measurements, null, 2),
  );
  console.log(
    `Verified ${measurements.length} actual Rive poses; no page errors. Screenshots: test-results/rig-foundation/`,
  );
} finally {
  await browser.close();
}
