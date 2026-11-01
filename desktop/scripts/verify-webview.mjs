// Drives the real Tavi Studio WebView2 window over the Chrome DevTools Protocol.
// Launch the installed app with remote debugging enabled first, for example (PowerShell):
//   $env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS = '--remote-debugging-port=9333'
//   & "$env:LOCALAPPDATA\Tavi Studio\tavi-studio.exe"
// Usage: node desktop/scripts/verify-webview.mjs [cdpUrl] [--open-twitch]
// Checks: studio renders inside the app webview with Rive assets and no CSP/page errors,
// page JavaScript cannot reach the opener plugin, and pop-ups never become app windows.
import { chromium } from '@playwright/test';

const cdp = process.argv[2]?.startsWith('http') ? process.argv[2] : 'http://127.0.0.1:9333';
const openTwitch = process.argv.includes('--open-twitch');
const problems = [];
const check = (ok, label) => {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`);
  if (!ok) problems.push(label);
};

const browser = await chromium.connectOverCDP(cdp);
try {
  const [context] = browser.contexts();
  const page = context.pages().find((candidate) => /127\.0\.0\.1:\d+\/studio(#.*)?$/.test(candidate.url()));
  if (!page) throw new Error(`Studio page not found: ${context.pages().map((p) => p.url())}`);
  console.log(`studio page: ${page.url()}`);
  const errors = [];
  page.on('console', (message) => {
    if (message.text().startsWith('Blank Script 1:1')) return; // known Rive asset message
    if (message.type() === 'error' || /content security policy/i.test(message.text()))
      errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  await page.reload();
  // The app opens on the Twitch sign-in screen until it is skipped once.
  const skip = page.getByRole('button', { name: 'Skip for now' });
  await page
    .getByText('Local service connected')
    .or(skip)
    .first()
    .waitFor({ timeout: 15000 });
  if (await skip.isVisible()) await skip.click();
  await page.getByText('Local service connected').waitFor({ timeout: 15000 });
  await page.locator('canvas').first().waitFor({ timeout: 15000 });
  const loaded = await page.evaluate(() =>
    performance
      .getEntriesByType('resource')
      .map((entry) => entry.name)
      .filter((name) => /\.(wasm|riv)$/.test(name)),
  );
  check(loaded.some((n) => n.endsWith('.wasm')), `Rive WASM loaded in app webview`);
  check(loaded.some((n) => n.endsWith('.riv')), `mascot .riv loaded in app webview`);
  const canvasSize = await page
    .locator('canvas')
    .first()
    .evaluate((canvas) => [canvas.width, canvas.height]);
  check(canvasSize[0] > 0 && canvasSize[1] > 0, `canvas has pixels ${canvasSize.join('x')}`);

  // The opener plugin is registered for Rust-side use only; page JS must be denied.
  const invoke = await page.evaluate(async () => {
    const internals = window.__TAURI_INTERNALS__;
    if (!internals?.invoke) return 'no-ipc';
    try {
      await internals.invoke('plugin:opener|open_url', { url: 'https://example.com' });
      return 'allowed';
    } catch (error) {
      return `denied: ${String(error)}`;
    }
  });
  check(invoke !== 'allowed', `page JS cannot call opener (${invoke})`);

  const pagesBefore = context.pages().length;
  const blocked = await page.evaluate(() => window.open('https://example.com/', '_blank'));
  await page.waitForTimeout(1000);
  check(
    blocked === null && context.pages().length === pagesBefore,
    'untrusted pop-up is denied and opens no app window',
  );
  const before = page.url();
  await page.evaluate(() => {
    location.href = 'https://example.com/';
  });
  await page.waitForTimeout(1000);
  check(page.url() === before, 'top-level navigation to an untrusted site is blocked');
  if (openTwitch) {
    const opened = await page.evaluate(() =>
      window.open('https://www.twitch.tv/activate', '_blank'),
    );
    await page.waitForTimeout(1000);
    check(
      opened === null && context.pages().length === pagesBefore,
      'Twitch activation pop-up handed to the system browser (confirm a browser tab opened)',
    );
  }
  check(errors.length === 0, `no CSP or page errors (${errors.join(' | ') || 'none'})`);
} finally {
  await browser.close();
}
console.log(problems.length ? `FAILED (${problems.length})` : 'ALL CHECKS PASSED');
process.exitCode = problems.length ? 1 : 0;
