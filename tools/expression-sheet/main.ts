// Expression sheet: every mascot face pose rendered through the real face layer (springs,
// overlap, living holds) on the motion layer's patched rig, large and at overlay size, plus an
// A -> B transition player. Serve the repo with Vite and open /tools/expression-sheet/.
// tools/expression-sheet/shoot.mjs screenshots it into test-results/expression-sheet/.
import { RuntimeLoader } from '@rive-app/webgl2';
import wasmURL from '@rive-app/webgl2/rive.wasm?url';
import { beat, type ExpressionScript } from '../../shared/cue';
import { expressions, type ExpressionId } from '../../shared/expressions';
import avatarURL from '../../src/renderer/characters/mascot/mascot.riv?url';
import { characters } from '../../src/renderer/characters/registry';
import { phaseLookup } from '../../src/renderer/compose';
import type { FaceValues } from '../../src/renderer/face/channels';
import { FaceLayer, type ActingClip } from '../../src/renderer/face/faceLayer';
import { poseChannels } from '../../src/renderer/face/pose';
import { performances } from '../../src/renderer/motion/hook';
import { MotionLayer } from '../../src/renderer/motion/motion';
import { sampleScript } from '../../src/renderer/timeline';
import { createSheetRig } from './rig';

RuntimeLoader.setWasmUrl(wasmURL);
RuntimeLoader.setWasmFallbackUrl(null);

const manifest = characters.get('mascot');
const face = manifest?.face;
if (!manifest || !face) throw new Error('mascot face missing');
const lookup = phaseLookup(manifest);
const ids = Object.keys(face.poses) as ExpressionId[];
const LARGE = { width: 320, height: 320, zoom: 1.7, focus: 0.42 };
const SMALL = { width: 180, height: 230 };

function script(steps: { id: ExpressionId; offset: number; hold: number }[], intensity: number) {
  return {
    id: 'sheet',
    sourceEventId: 'sheet',
    source: 'manual',
    decidedBy: { kind: 'manual', label: 'Sheet' },
    priority: 3,
    startAt: 0,
    expiresAt: 600000,
    beats: steps.map((step) => ({
      ...beat(step.id, { hold: step.hold, intensity, target: 'chat' }),
      offset: step.offset,
    })),
    settle: true,
    dropped: [],
  } satisfies ExpressionScript;
}

/** Runs the face layer from the cue start to `seconds` (60 fps) and returns that frame. */
function faceAt(id: ExpressionId, intensity: number, seconds: number) {
  const cue = script([{ id, offset: 0, hold: 30 }], intensity);
  const layer = new FaceLayer(face ?? ({} as never), { ownBlinks: false, seed: 7 });
  let result: { values: FaceValues; clips: ActingClip[] } = { values: {}, clips: [] };
  for (let frame = 0; frame <= Math.round(seconds * 60); frame++) {
    const time = frame / 60;
    result = layer.update({ dt: 1 / 60, time, cues: sampleScript(cue, time * 1000, lookup) });
  }
  return result;
}

function element<T extends HTMLElement>(selector: string) {
  const found = document.querySelector<T>(selector);
  if (!found) throw new Error('missing ' + selector);
  return found;
}

async function main() {
  const [runtime, bytes] = await Promise.all([
    RuntimeLoader.awaitInstance(),
    fetch(avatarURL).then(async (response) => new Uint8Array(await response.arrayBuffer())),
  ]);
  const offscreenLarge = element<HTMLCanvasElement>('#render');
  const offscreenSmall = document.createElement('canvas');
  offscreenSmall.style.cssText = 'position:absolute;left:-9999px';
  document.body.append(offscreenSmall);
  const large = await createSheetRig(runtime, offscreenLarge, bytes, LARGE.width, LARGE.height);
  const small = await createSheetRig(runtime, offscreenSmall, bytes, SMALL.width, SMALL.height);
  const playerLarge = await createSheetRig(
    runtime,
    element('#player-large'),
    bytes,
    LARGE.width,
    LARGE.height,
  );
  const playerSmall = await createSheetRig(
    runtime,
    element('#player-small'),
    bytes,
    SMALL.width,
    SMALL.height,
  );
  const ratio = Math.min(devicePixelRatio || 1, 2);

  const grid = element('#grid');
  const cells = new Map<
    ExpressionId,
    { large: CanvasRenderingContext2D; small: CanvasRenderingContext2D }
  >();
  for (const id of ids) {
    const card = document.createElement('article');
    card.className = 'card';
    card.dataset['expression'] = id;
    const def = expressions[id];
    const title = document.createElement('h3');
    title.textContent = def.label;
    const meta = document.createElement('small');
    meta.textContent = `${id} · ${def.channel}`;
    title.append(meta);
    const make = (width: number, height: number, css: number) => {
      const canvas = document.createElement('canvas');
      canvas.width = width * ratio;
      canvas.height = height * ratio;
      canvas.style.width = `${String(css)}px`;
      canvas.style.height = `${String((css * height) / width)}px`;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('2d context');
      return { canvas, context };
    };
    const big = make(LARGE.width, LARGE.height, 150);
    const little = make(SMALL.width, SMALL.height, SMALL.width * 0.5);
    little.canvas.className = 'small';
    little.canvas.title = 'Overlay size: 220 px tall body';
    const text = document.createElement('p');
    text.textContent = def.meaning;
    card.append(title, big.canvas, little.canvas, text);
    grid.append(card);
    cells.set(id, { large: big.context, small: little.context });
  }

  const intensityInput = element<HTMLSelectElement>('#intensity');
  function renderGrid() {
    const intensity = Number(intensityInput.value);
    for (const [id, cell] of cells) {
      const { values, clips } = faceAt(id, intensity, lookup(id).anticipation + 1.2);
      large.draw(values, { zoom: LARGE.zoom, focus: LARGE.focus, clips });
      cell.large.drawImage(offscreenLarge, 0, 0, cell.large.canvas.width, cell.large.canvas.height);
      small.draw(values, { zoom: 1, clips });
      cell.small.drawImage(offscreenSmall, 0, 0, cell.small.canvas.width, cell.small.canvas.height);
    }
  }
  intensityInput.addEventListener('change', renderGrid);
  renderGrid();

  // Transition player -----------------------------------------------------------------------
  const from = element<HTMLSelectElement>('#from'),
    to = element<HTMLSelectElement>('#to');
  for (const select of [from, to])
    for (const id of ids) select.append(new Option(expressions[id].label, id));
  const params = new URLSearchParams(location.search);
  from.value = params.get('from') ?? 'content';
  to.value = params.get('to') ?? 'innocent';
  const label = element('#player-label'),
    clock = element('#player-time');
  // The player runs the full stack the overlay runs: the motion layer (idle life, gaze, blinks,
  // performances such as Oops/skeptical/nod) with the face layer feeding it, as in motion/hook.ts.
  interface Run {
    face: FaceLayer;
    motion: MotionLayer;
    cue: ExpressionScript;
    time: number;
    performing: Set<string>;
  }
  let run: Run | null = null;
  let lastPose: unknown = null;
  const HOLD_A = 1.6;
  const settings = {
    personality: 'playful',
    attitude: 'cheeky',
    energy: 60,
    reducedMotion: false,
    quiet: false,
  } as const;
  function start() {
    const a = from.value as ExpressionId,
      b = to.value as ExpressionId;
    label.textContent = `${expressions[a].label} → ${expressions[b].label}`;
    const motion = new MotionLayer(
      20261025,
      settings,
      { aspect: 1, bodyHeight: 0.3, margin: 0.02 },
      { feet: true },
    );
    motion.place(0.5, 0.9);
    run = {
      face: new FaceLayer(face ?? ({} as never), { seed: 20261025, ownBlinks: false }),
      motion,
      cue: script(
        [
          { id: a, offset: 0, hold: HOLD_A },
          { id: b, offset: HOLD_A + 0.1, hold: 2.4 },
        ],
        Number(intensityInput.value),
      ),
      time: 0,
      performing: new Set(),
    };
  }
  /** Advances the player by `dt` and draws; exposed for deterministic screenshots. */
  function step(dt: number) {
    if (!run || !manifest) return;
    run.time += dt;
    const layers = sampleScript(run.cue, run.time * 1000, lookup);
    const owned = new Map<string, ReadonlySet<string>>();
    const current = new Set<string>();
    const cues = layers.map((cue) => {
      const performance = manifest.expressions[cue.expression]?.motion;
      const motionId = performance ? performances[performance] : undefined;
      if (motionId) {
        current.add(motionId);
        if (!run?.performing.has(motionId))
          run?.motion.express(motionId, { at: run.time - cue.elapsed, intensity: cue.intensity });
        const pose = face?.poses[cue.expression];
        if (pose) owned.set(motionId, poseChannels(pose));
      }
      return { ...cue, featuresOnly: Boolean(motionId) };
    });
    for (const id of run.performing) if (!current.has(id)) run.motion.release(id, run.time);
    run.performing = current;
    const result = run.face.update({ dt, time: run.time, cues });
    const frame = run.motion.update(run.time, {
      values: result.values,
      owned,
      blinkScale: result.blink.rate / (face?.blink.rate ?? 17),
      clips: result.clips,
    });
    clock.textContent = `t = ${run.time.toFixed(2)} s`;
    lastPose = frame.pose;
    playerLarge.drawFrame(frame, { zoom: LARGE.zoom, focus: LARGE.focus, dt });
    playerSmall.drawFrame(frame, { zoom: 1, dt });
  }
  element('#play').addEventListener('click', start);
  let last = performance.now();
  let paused = params.has('paused');
  const loop = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!paused) {
      if (!run || run.time > HOLD_A + 4) start();
      step(dt);
    }
    requestAnimationFrame(loop);
  };
  start();
  step(0);
  requestAnimationFrame(loop);
  Object.assign(window, {
    sheet: {
      ids,
      /** Pauses the live player and jumps to `seconds` after A starts, at 60 fps. */
      pose: () => lastPose,
      seek(seconds: number, a?: string, b?: string) {
        paused = true;
        if (a) from.value = a;
        if (b) to.value = b;
        start();
        for (let frame = 0; frame < Math.round(seconds * 60); frame++) step(1 / 60);
      },
      setIntensity(value: number) {
        intensityInput.value = String(value);
        renderGrid();
      },
    },
  });
  document.body.dataset['ready'] = 'true';
}
main().catch((error: unknown) => {
  console.error(error);
  document.body.dataset['error'] = String(error);
});
