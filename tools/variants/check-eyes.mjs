// Real-renderer regression: compare each pupil with its OWN moving iris centre, not the head.
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

const browser = await chromium.launch({
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
try {
  const page = await browser.newPage();
  const base = process.env.TAVI_TEST_URL ?? 'http://127.0.0.1:5173';
  await page.goto(`${base}/tools/variants/sheet.html?only=eye-regression`, {
    waitUntil: 'domcontentloaded',
  });
  const rows = await page.evaluate(async () => {
    const [{ characters }, { createCharacterRenderer }, { mascotV2Motion }, { neutralPose }] =
      await Promise.all([
        import('/src/renderer/characters/registry.ts'),
        import('/src/renderer/adapter.ts'),
        import('/src/renderer/characters/mascot-v2/motion.ts'),
        import('/src/renderer/motion/types.ts'),
      ]);
    const canvas = document.createElement('canvas');
    canvas.width = 420;
    canvas.height = 600;
    document.body.append(canvas);
    const renderer = await createCharacterRenderer(canvas, characters.get('mascot-v2'));
    renderer.resize(420, 600);
    let points = {};
    renderer.setDecorator((view, world) => {
      points = {};
      for (const name of [
        'pupil_2',
        'pupil',
        'pupil constraint_hidden',
        'pupil constraint_hidden 2',
      ])
        points[name] = world({
          node: name,
          kind: 'node',
          offset: [0, 0],
          size: 1,
          follow: 1,
          rotation: 0,
        });
    });
    const rows = [];
    try {
      for (const turn of [-1, -0.6, 0, 0.6, 1])
        for (const axis of ['gazeX', 'gazeY', 'pupilX', 'pupilY'])
          for (const direction of [-1, 1]) {
            const bound = mascotV2Motion.bind({
              time: 0,
              pose: { ...neutralPose(), turnHead: turn, turnBody: turn, [axis]: direction * 0.8 },
              clips: [],
              placement: {
                x: 0.5,
                y: 0.9,
                lean: 0,
                facing: 1,
                scaleX: 1,
                scaleY: 1,
                opacity: 1,
                clipBelow: null,
              },
            });
            for (let i = 0; i < 5; i++) {
              renderer.applyFrame({ tracks: bound.tracks, inputs: {}, nodes: bound.nodes });
              renderer.draw(1 / 60, { x: 210, y: 594, width: 420, height: 600, rotation: 0 });
            }
            const offsets = [
              ['pupil_2', 'pupil constraint_hidden'],
              ['pupil', 'pupil constraint_hidden 2'],
            ].map(([pupil, centre]) => {
              const p = points[pupil],
                c = points[centre];
              if (!p || !c) throw new Error(`Missing eye component ${pupil}/${centre}`);
              return { x: p[4] - c[4], y: p[5] - c[5] };
            });
            rows.push({ turn, axis, direction, offsets });
          }
    } finally {
      renderer.dispose();
    }
    return rows;
  });
  await mkdir('test-results/eyes', { recursive: true });
  await writeFile('test-results/eyes/metrics.json', JSON.stringify(rows, null, 2));
  const failures = rows.filter((row) =>
    row.offsets.some(
      (offset) =>
        offset[row.axis.endsWith('X') ? 'x' : 'y'] * row.direction < 0.5 ||
        Math.hypot(offset.x, offset.y) > 8.05,
    ),
  );
  if (failures.length)
    throw new Error(
      `${failures.length}/${rows.length} eye cases look away from the requested direction: ${JSON.stringify(failures.slice(0, 2))}`,
    );
  console.log(
    `${rows.length} turned gaze/pupil cases: both pupils follow their own iris centres and requested direction`,
  );
} finally {
  await browser.close();
}
