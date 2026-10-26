// Capture the authored step turn and return to front at the actual Rive binding boundary.
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

const browser = await chromium.launch({
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
try {
  const page = await browser.newPage({ viewport: { width: 1900, height: 1650 } });
  const base = process.env.TAVI_TEST_URL ?? 'http://127.0.0.1:5173';
  await page.goto(`${base}/tools/variants/sheet.html?only=turn-regression`);
  const metrics = await page.evaluate(async () => {
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
    for (const scenario of ['left', 'right', 'reverse', 'arrival']) {
      const heading = document.createElement('h2');
      heading.textContent = {
        left: 'Front → left: head leads, supporting foot stays planted',
        right: 'Front → right: head leads, supporting foot stays planted',
        reverse: 'Right walk → left walk: torso passes through front',
        arrival: 'Left walk → front idle: settle before restoring handedness',
      }[scenario];
      document.body.append(heading);
      const row = document.createElement('div');
      row.style.display = 'flex';
      document.body.append(row);
      const canvas = document.createElement('canvas');
      canvas.width = 250;
      canvas.height = 350;
      const renderer = await createCharacterRenderer(canvas, characters.get('mascot-v2'));
      renderer.resize(250, 350);
      const layer = new MotionLayer(
        7,
        { personality: 'cozy', attitude: 'gentle', energy: 40, reducedMotion: false, quiet: false },
        { aspect: 16 / 9, bodyHeight: 220 / 720, margin: 0.02 },
        { feet: true, turnStyle: 'authored', authored: ['walk', 'trudge'] },
      );
      const left = scenario === 'left' || scenario === 'arrival';
      layer.place(left ? 0.7 : 0.3, 0.9);
      layer.moveTo({
        x: scenario === 'arrival' ? 0.66 : left ? 0.4 : 0.85,
        at: 0,
        gait: 'walk',
        beats: 'none',
      });
      let sampleStart = scenario === 'reverse' ? 1 : scenario === 'arrival' ? Infinity : 0;
      let nextSample = 0;
      const times = [0, 0.08, 0.16, 0.24, 0.32, 0.46, 0.66];
      const samples = [];
      const states = [];
      try {
        for (let i = 0; i <= 600 && nextSample < times.length; i++) {
          const now = i / 60;
          if (scenario === 'reverse' && i === 60)
            layer.moveTo({ x: 0.2, at: now, gait: 'walk', beats: 'none' });
          const frame = layer.update(now);
          if (states.at(-1)?.state !== frame.status.locomotion)
            states.push({ time: now, state: frame.status.locomotion });
          if (scenario === 'arrival' && frame.status.locomotion.startsWith('arriving'))
            sampleStart = Math.min(sampleStart, now);
          const bound = mascotV2Motion.bind(frame);
          renderer.applyFrame({ tracks: bound.tracks, inputs: {}, nodes: bound.nodes });
          renderer.draw(1 / 60, { x: 125, y: 346, width: 250, height: 350, rotation: 0 });
          if (now - sampleStart + 1e-5 < times[nextSample]) continue;
          const figure = document.createElement('figure');
          figure.style.margin = '0 8px 0 0';
          const shot = document.createElement('canvas');
          shot.width = 250;
          shot.height = 350;
          const ctx = shot.getContext('2d');
          ctx.fillStyle = '#f3f1ec';
          ctx.fillRect(0, 0, 250, 350);
          ctx.translate(125, 0);
          ctx.scale(frame.placement.facing, 1);
          ctx.translate(-125, 0);
          ctx.drawImage(canvas, 0, 0);
          const caption = document.createElement('figcaption');
          caption.textContent = `${(now - sampleStart).toFixed(2)}s · ${frame.status.locomotion} · body ${(frame.pose.turnBody * frame.placement.facing).toFixed(2)}`;
          caption.style.fontSize = '12px';
          figure.append(shot, caption);
          row.append(figure);
          samples.push({
            time: now - sampleStart,
            facing: frame.placement.facing,
            body: frame.pose.turnBody * frame.placement.facing,
            head: frame.pose.turnHead * frame.placement.facing,
          });
          nextSample++;
        }
      } finally {
        renderer.dispose();
      }
      results.push({ scenario, samples, states });
    }
    return results;
  });
  await mkdir('test-results/eyes', { recursive: true });
  await writeFile('test-results/eyes/turn-metrics.json', JSON.stringify(metrics, null, 2));
  await page.screenshot({ path: 'test-results/eyes/turn.png', fullPage: true });
  console.log('Rendered authored step turns: test-results/eyes/turn.png');
} finally {
  await browser.close();
}
