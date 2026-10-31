// Places the chat panel left, then right, triggers the chat look, and checks studio and overlay
// look toward the real panel. Screenshots go to test-results/attention-*.png.
// Usage: TAVI_TEST_URL=http://127.0.0.1:5173 node tools/attention-browser-check.mjs
import { chromium, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
const base = process.env.TAVI_TEST_URL ?? 'http://127.0.0.1:5173';
const browser = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader'] });
const state = async (page) => await (await page.request.get(base + '/api/state')).json();
async function send(page, commands) {
  await page.evaluate(async (commands) => {
    await new Promise((resolve, reject) => {
      const socket = new WebSocket(`ws://${location.host}/ws`);
      let count = -1;
      socket.onmessage = () => {
        if (count === -1) {
          count = 0;
          for (const command of commands) socket.send(JSON.stringify(command));
        } else if (++count >= commands.length) {
          socket.close();
          resolve();
        }
      };
      socket.onerror = reject;
    });
  }, commands);
}
try {
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
  await page.goto(base + '/studio');
  await expect(page.locator('.st-screen .avatar-renderer')).toHaveAttribute('data-ready', 'true', {
    timeout: 30000,
  });
  const overlay = await (
    await browser.newContext({ viewport: { width: 1280, height: 720 } })
  ).newPage();
  await overlay.goto(base + '/overlay');
  await expect(overlay.locator('.avatar-renderer')).toHaveAttribute('data-ready', 'true', {
    timeout: 30000,
  });
  const original = (await state(page)).config;
  await mkdir('test-results', { recursive: true });
  const tuck = page.getByRole('switch', { name: 'Tuck her away' });
  if ((await tuck.getAttribute('aria-checked')) === 'true') await tuck.click();
  const dock = page.getByRole('group', { name: 'Reactions' });
  try {
    for (const [name, chat, expected] of [
      ['left', { enabled: true, x: 0.02, y: 0.1, w: 0.2, h: 0.45 }, 'chat:left'],
      ['right', { enabled: true, x: 0.76, y: 0.08, w: 0.22, h: 0.5 }, 'chat:right'],
    ]) {
      // Tavi stands mid-screen so the panel side is unambiguous.
      await send(page, [
        { type: 'configure', patch: { x: 0.5, y: 0.8, scene: { ...original.scene, chat } } },
      ]);
      await page.waitForTimeout(4000);
      await dock.getByRole('button', { name: 'Look at chat', exact: true }).click();
      await expect(page.locator('.st-screen .avatar-renderer')).toHaveAttribute(
        'data-attention',
        expected,
        {
          timeout: 5000,
        },
      );
      await expect(overlay.locator('.avatar-renderer')).toHaveAttribute(
        'data-attention',
        expected,
        {
          timeout: 5000,
        },
      );
      await page.waitForTimeout(400);
      await page.locator('.st-screen').screenshot({ path: `test-results/attention-${name}.png` });
    }
    console.log(
      'Attention browser check passed: chat look follows the chat panel left and right, studio and overlay agree.',
    );
  } finally {
    const { version: _version, ...patch } = original;
    await send(page, [{ type: 'configure', patch }]);
  }
} finally {
  await browser.close();
}
