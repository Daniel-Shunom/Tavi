// Production authored gait + turn + pupil rendering in both travel directions.
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

const browser = await chromium.launch({
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
try {
  const page = await browser.newPage({
    viewport: { width: 1900, height: 1600 },
    deviceScaleFactor: 1,
  });
  const base = process.env.TAVI_TEST_URL ?? 'http://127.0.0.1:5173';
  await page.goto(`${base}/tools/variants/sheet.html?only=travel-regression`, {
    waitUntil: 'domcontentloaded',
  });
  const rows = await page.evaluate(async () => {
    const [{ characters }, { createCharacterRenderer }, { mascotV2Motion }, { MotionLayer }] =
      await Promise.all([
        import('/src/renderer/characters/registry.ts'),
        import('/src/renderer/adapter.ts'),
        import('/src/renderer/characters/mascot-v2/motion.ts'),
        import('/src/renderer/motion/motion.ts'),
      ]);
    document.body.replaceChildren();
    document.body.style.cssText = 'margin:0;padding:16px;background:#e5e5e8;font:16px system-ui';
    const results = [];
    for (const gait of ['walk', 'trudge'])
      for (const direction of [-1, 1]) {
        const heading = document.createElement('h2');
        heading.textContent = `${gait}: travelling ${direction < 0 ? 'LEFT ←' : 'RIGHT →'}`;
        document.body.append(heading);
        const row = document.createElement('div');
        row.style.display = 'flex';
        document.body.append(row);
        const canvas = document.createElement('canvas');
        canvas.width = 300;
        canvas.height = 400;
        const renderer = await createCharacterRenderer(canvas, characters.get('mascot-v2'));
        renderer.resize(300, 400);
        const layer = new MotionLayer(
          7,
          {
            personality: 'cozy',
            attitude: 'gentle',
            energy: 40,
            reducedMotion: false,
            quiet: false,
          },
          { aspect: 16 / 9, bodyHeight: 220 / 720, margin: 0.02 },
          { feet: true, turnStyle: 'authored', authored: ['walk', 'trudge'] },
        );
        layer.place(direction > 0 ? 0.3 : 0.7, 0.9);
        layer.moveTo({ x: direction > 0 ? 0.85 : 0.15, at: 0, gait });
        const samples = [];
        try {
          for (let i = 0; i <= 144; i++) {
            const frame = layer.update(i / 60),
              bound = mascotV2Motion.bind(frame);
            renderer.applyFrame({ tracks: bound.tracks, inputs: {}, nodes: bound.nodes });
            renderer.draw(1 / 60, { x: 150, y: 396, width: 300, height: 400, rotation: 0 });
            if (![24, 48, 72, 96, 120, 144].includes(i)) continue;
            const figure = document.createElement('figure');
            figure.style.margin = '0 4px 0 0';
            const shot = document.createElement('canvas');
            shot.width = 300;
            shot.height = 400;
            const ctx = shot.getContext('2d');
            ctx.fillStyle = '#f3f1ec';
            ctx.fillRect(0, 0, 300, 400);
            ctx.translate(150, 0);
            ctx.scale(frame.placement.facing, 1);
            ctx.translate(-150, 0);
            ctx.drawImage(canvas, 0, 0);
            const label = document.createElement('figcaption');
            label.textContent = `${(i / 60).toFixed(1)}s · turn ${frame.pose.turnHead.toFixed(2)} · eyes ${frame.pose.gazeX.toFixed(2)}`;
            figure.append(shot, label);
            row.append(figure);
            samples.push({
              time: i / 60,
              x: frame.placement.x,
              gaze: frame.pose.gazeX,
              head: frame.pose.turnHead,
              body: frame.pose.turnBody,
              facing: frame.placement.facing,
              clip: frame.clips.find((c) => c.role === `gait:${gait}`)?.time,
            });
          }
        } finally {
          renderer.dispose();
        }
        results.push({ gait, direction, samples });
      }
    return results;
  });
  await mkdir('test-results/eyes', { recursive: true });
  await writeFile('test-results/eyes/travel-metrics.json', JSON.stringify(rows, null, 2));
  await page.screenshot({ path: 'test-results/eyes/travel.png', fullPage: true });
  console.log('Rendered walk and trudge both ways: test-results/eyes/travel.png');
} finally {
  await browser.close();
}
