// Read-only Studio render check. Does not submit a support event or alter saved settings.
import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('http://127.0.0.1:5173', { waitUntil: 'networkidle' });
  await page.addStyleTag({ content: '.tools-scroll { scroll-behavior: auto !important; }' });
  const panel = page.locator('.support-reactions');
  await panel.locator('summary').click();
  await panel.getByRole('button', { name: 'Preview donation' }).waitFor();
  await panel.getByLabel('Simulated event').selectOption('subscription');
  await panel.getByRole('button', { name: 'Preview subscription' }).waitFor();
  await mkdir('test-results/support', { recursive: true });
  await panel.locator('form').last().screenshot({ path: 'test-results/support/preview.png' });
  await panel.locator('form').first().screenshot({ path: 'test-results/support/settings.png' });
  if (errors.length) throw new Error(errors.join('\n'));
  console.log('Rendered support preview controls: test-results/support/preview.png');
} finally {
  await browser.close();
}
