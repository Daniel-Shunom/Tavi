// Read-only browser verification of the OBS connection controls. Never changes OBS or saved layout.
import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('http://127.0.0.1:5173', { waitUntil: 'networkidle' });
  await page.addStyleTag({ content: '.tools-scroll { scroll-behavior: auto !important; }' });
  await page.getByRole('tab', { name: 'Placement', exact: true }).click();
  const panel = page.locator('.obs-awareness');
  await panel.getByRole('button', { name: 'Find webcam in OBS' }).waitFor();
  await panel
    .getByText('Connect OBS to locate the webcam automatically.', { exact: true })
    .waitFor();
  await mkdir('test-results/obs', { recursive: true });
  await panel.screenshot({ path: 'test-results/obs/connection.png' });
  await page.goto('http://127.0.0.1:5173/overlay', { waitUntil: 'networkidle' });
  await page.locator('[data-ready="true"]').first().waitFor();
  await page.screenshot({ path: 'test-results/obs/overlay.png' });
  if (errors.length) throw new Error(errors.join('\n'));
  console.log(
    'Studio OBS controls and overlay rendered without page errors. test-results/obs/connection.png',
  );
} finally {
  await browser.close();
}
