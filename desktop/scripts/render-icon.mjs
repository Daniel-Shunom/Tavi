// Renders the app icon source (1024x1024 PNG) from the live overlay's Rive mascot, then run:
//   npx tauri icon <out.png>   (in desktop/), and delete the non-Windows outputs.
// The mascot is third-party CC BY 4.0 artwork (see public/credits/); the icon is an adaptation
// and the attribution ships in THIRD-PARTY-NOTICES.txt.
// Usage: node desktop/scripts/render-icon.mjs http://127.0.0.1:4318 icon-source.png
import { chromium } from '@playwright/test';
import { writeFile } from 'node:fs/promises';

const [base = 'http://127.0.0.1:4318', out = 'icon-source.png'] = process.argv.slice(2);
const browser = await chromium.launch();
try {
  const page = await browser.newPage({
    viewport: { width: 1400, height: 900 },
    deviceScaleFactor: 8,
  });
  await page.goto(`${base}/overlay`);
  await page.waitForTimeout(5000);
  const shot = await page.screenshot({ omitBackground: true, type: 'png' });
  const compose = await browser.newPage();
  const png = await compose.evaluate(async (source) => {
    const image = new Image();
    image.src = source;
    await image.decode();
    const frame = document.createElement('canvas');
    frame.width = image.width;
    frame.height = image.height;
    const context = frame.getContext('2d');
    context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, frame.width, frame.height).data;
    let minX = frame.width;
    let minY = frame.height;
    let maxX = 0;
    for (let y = 0; y < frame.height; y++)
      for (let x = 0; x < frame.width; x++)
        if (pixels[(y * frame.width + x) * 4 + 3] > 16) {
          minX = Math.min(minX, x);
          maxX = Math.max(maxX, x);
          minY = Math.min(minY, y);
        }
    // Head and shoulders: a square from the top of the figure, slightly wider than the hair.
    const width = maxX - minX;
    const side = width * 1.08;
    const size = 1024;
    const icon = document.createElement('canvas');
    icon.width = icon.height = size;
    const g = icon.getContext('2d');
    g.beginPath();
    g.roundRect(32, 32, size - 64, size - 64, 220);
    const gradient = g.createLinearGradient(0, 0, size, size);
    gradient.addColorStop(0, '#7c5cff');
    gradient.addColorStop(1, '#4a2fd0');
    g.fillStyle = gradient;
    g.fill();
    g.clip();
    g.drawImage(frame, minX + width / 2 - side / 2, minY - side * 0.04, side, side, 62, 92, 900, 900);
    return icon.toDataURL('image/png');
  }, `data:image/png;base64,${shot.toString('base64')}`);
  await writeFile(out, Buffer.from(png.split(',')[1], 'base64'));
  console.log(`Wrote ${out}`);
} finally {
  await browser.close();
}
