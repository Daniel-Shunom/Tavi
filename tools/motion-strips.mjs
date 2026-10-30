// Renders Tavi's runtime motion clips as frame strips plus an onion-skin overlay, through the same
// applyFrame path the site uses. For before/after review of motion refinements: run it with one
// label before a change and another after, then compare build/motion-audit/<clip>-<label>.png.
// Requires a Vite dev server: TAVI_TEST_URL=http://127.0.0.1:5173 node tools/motion-strips.mjs before
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

const base = process.env.TAVI_TEST_URL ?? 'http://127.0.0.1:5173';
const label = process.argv[2] ?? 'current';
const only = process.argv[3];
const frames = 10;

// Each spec samples u = 0..1 across one loop or transition. `mode` and `side` mirror the
// runtime-mode node the refined binder and the landing set for authored foundations.
const turn = (facing) => [
  { track: 'ctl.turn-body', time: Math.min(0.999, (facing + 1) / 2), mix: 1 },
  { track: 'ctl.turn-head', time: Math.min(0.999, (facing * 0.85 + 1) / 2), mix: 1 },
];
const specs = {
  'walk-right': (u) => ({
    tracks: [{ track: 'runtime.gait.walk-right', time: u, mix: 1 }, ...turn(1)],
    mode: 6,
    side: 0,
  }),
  'sprint-right': (u) => ({
    tracks: [{ track: 'runtime.gait.sprint-right', time: u, mix: 1 }, ...turn(1)],
    mode: 6,
    side: 0,
  }),
  'skip-right': (u) => ({
    tracks: [{ track: 'runtime.gait.skip-right', time: u, mix: 1 }, ...turn(1)],
    mode: 6,
    side: 0,
  }),
  'perch-front': (u) => ({
    tracks: [{ track: 'runtime.pose.perch-front', time: u, mix: 1 }, ...turn(0)],
    mode: 6,
    side: 0,
  }),
  'floor-front': (u) => ({
    tracks: [{ track: 'runtime.pose.floor-front', time: u, mix: 1 }, ...turn(0)],
    mode: 6,
    side: 0,
  }),
  'turn-front-right': (u) => ({ tracks: turn(u), mode: 0, side: 0 }),
};

const browser = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader'] });
try {
  const page = await browser.newPage({ viewport: { width: 400, height: 400 } });
  await page.goto(base + '/?motion-strips');
  const names = Object.keys(specs).filter((name) => !only || name === only);
  const samples = Object.fromEntries(
    names.map((name) => [name, Array.from({ length: frames }, (_, i) => specs[name](i / frames))]),
  );
  const report = await page.evaluate(async (samples) => {
    const registry = await import('/src/renderer/characters/registry.ts');
    const rive = await import('/src/renderer/rive/riveRenderer.ts');
    const manifest = registry.getCharacter('tavi-refined');
    document.body.innerHTML = '';
    document.body.style.margin = '0';
    const canvas = document.createElement('canvas');
    canvas.style.width = '300px';
    canvas.style.height = '300px';
    document.body.append(canvas);
    const view = await rive.createRiveRenderer(canvas, manifest);
    view.resize(300, 300);
    const size = 300;
    const placement = {
      x: size / 2,
      y: size * 0.92,
      width: size * 0.8,
      height: size * 0.8,
      rotation: 0,
    };
    const output = {};
    for (const [name, list] of Object.entries(samples)) {
      const cell = 180;
      const strip = document.createElement('canvas');
      strip.width = list.length * cell;
      strip.height = cell;
      const onion = document.createElement('canvas');
      onion.width = onion.height = 360;
      const s = strip.getContext('2d');
      const o = onion.getContext('2d');
      s.fillStyle = o.fillStyle = '#fbf9f4';
      s.fillRect(0, 0, strip.width, strip.height);
      o.fillRect(0, 0, onion.width, onion.height);
      list.forEach((sample, index) => {
        view.applyFrame({
          tracks: sample.tracks,
          inputs: {},
          nodes: { 'runtime-mode': { x: sample.mode, y: sample.side, rotation: 0 } },
        });
        view.draw(0, placement);
        s.drawImage(canvas, index * cell, 0, cell, cell);
        o.globalAlpha = 0.22;
        o.drawImage(canvas, 0, 0, 360, 360);
        o.globalAlpha = 1;
        s.fillStyle = '#7a6a8f';
        s.font = '12px sans-serif';
        s.fillText((index / list.length).toFixed(2), index * cell + 6, 14);
      });
      // Reference lines: the ground and the head height of the first frame expose bob and drift.
      for (const [context, width, scale] of [
        [s, strip.width, cell / size],
        [o, 360, 360 / size],
      ]) {
        context.strokeStyle = 'rgba(220,60,60,.55)';
        context.beginPath();
        context.moveTo(0, placement.y * scale);
        context.lineTo(width, placement.y * scale);
        context.stroke();
      }
      output[name] = { strip: strip.toDataURL('image/png'), onion: onion.toDataURL('image/png') };
    }
    return output;
  }, samples);
  await mkdir('build/motion-audit', { recursive: true });
  for (const [name, images] of Object.entries(report))
    for (const [kind, data] of Object.entries(images)) {
      const file = `build/motion-audit/${name}-${kind}-${label}.png`;
      await writeFile(file, Buffer.from(data.split(',')[1], 'base64'));
      console.log(file);
    }
} finally {
  await browser.close();
}
