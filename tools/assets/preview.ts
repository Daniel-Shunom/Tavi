// Attachment preview: the live character with every slot, tint pickers and motion presets.
// Served by Vite at /tools/assets/preview.html. Screenshot mode: ?shot&equip=slot:id,...&clip=..&t=..
import { RuntimeLoader } from '@rive-app/webgl2';
import type { Artboard, LinearAnimationInstance } from '@rive-app/webgl2/rive_advanced.mjs';
import wasmURL from '@rive-app/webgl2/rive.wasm?url';
import avatarURL from '../../src/renderer/assets/mascot.riv?url';
import { loadAttachments, itemsForSlot } from '../../src/renderer/attachments/catalog';
import {
  createAttachmentLayer,
  multiply,
  slotFrame,
  type Affine,
} from '../../src/renderer/attachments/layer';
import { hide, recolor, lylaRecolor } from '../../src/renderer/attachments/recolor';
import {
  patchForAttachments,
  riveTransformSource,
  viewMatrix,
} from '../../src/renderer/attachments/rive';
import { lylaAttachmentRig, lylaSlots } from '../../src/renderer/attachments/rigs/lyla';
import {
  slotIds,
  type AttachmentTints,
  type EquippedAttachments,
  type SlotId,
} from '../../src/renderer/attachments/schema';

RuntimeLoader.setWasmUrl(wasmURL);
RuntimeLoader.setWasmFallbackUrl(null);

const params = new URLSearchParams(location.search);
const shot = params.has('shot');
if (shot) document.body.classList.add('shot');
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const errorBox = $('error');

const { items } = loadAttachments();
const equipped: EquippedAttachments = {};
for (const pair of (params.get('equip') ?? '').split(',').filter(Boolean)) {
  const [slot, id] = pair.split(':');
  if (slot && id) equipped[slot as SlotId] = id;
}
if (!params.has('equip') && !shot) {
  equipped['head.top'] = 'beanie';
}
const tints: AttachmentTints = {};
for (const [key, value] of params) {
  const match = /^tint\.([a-z0-9-]+)\.([a-zA-Z0-9]+)$/.exec(key);
  if (match?.[1] && match[2]) (tints[match[1]] ??= {})[match[2]] = value;
}
const colours = {
  hair: params.get('hair') ?? '#d80b4c',
  outfit: params.get('outfit') ?? '#276065',
};
let builtGlasses = true;
const wantGlasses = () => !equipped['head.face'] && params.get('glasses') !== 'hide';

const IDLE_CLIPS = [
  'back and forth',
  'wave',
  'celebration',
  'hands on hips',
  'thoughtful',
  'testing',
  'squash stretch',
];

const runtime = await RuntimeLoader.awaitInstance();
const source = new Uint8Array(await (await fetch(avatarURL)).arrayBuffer());
const riveCanvas = $<HTMLCanvasElement>('rive');
const back = $<HTMLCanvasElement>('back').getContext('2d');
const front = $<HTMLCanvasElement>('front').getContext('2d');
if (!back || !front) throw new Error('2D canvas unavailable');
const renderer = runtime.makeRenderer(riveCanvas, true);
const layer = createAttachmentLayer({ slots: lylaSlots, items, path: (d) => new Path2D(d) });

interface Loaded {
  board: Artboard;
  clips: Map<string, { instance: LinearAnimationInstance; duration: number }>;
  dispose(): void;
}
let loaded: Loaded | undefined;
async function build() {
  let bytes = patchForAttachments(source, lylaAttachmentRig);
  bytes = recolor(bytes, lylaRecolor.artboard, lylaRecolor.hair, colours.hair);
  bytes = recolor(bytes, lylaRecolor.artboard, lylaRecolor.outfit, colours.outfit);
  builtGlasses = wantGlasses();
  if (!builtGlasses) bytes = hide(bytes, lylaRecolor.artboard, lylaRecolor.glasses);
  const file = await runtime.load(bytes, undefined, false);
  const board = file.artboardByName('lyla animation');
  const clips = new Map<string, { instance: LinearAnimationInstance; duration: number }>();
  for (let i = 0; i < board.animationCount(); i++) {
    const definition = board.animationByIndex(i);
    clips.set(definition.name, {
      instance: new runtime.LinearAnimationInstance(definition, board),
      duration: definition.duration / definition.fps,
    });
  }
  loaded?.dispose();
  loaded = {
    board,
    clips,
    dispose() {
      for (const clip of clips.values()) clip.instance.delete();
      board.delete();
      file.unref();
    },
  };
}
await build();

const clipSelect = $<HTMLSelectElement>('clip');
for (const name of IDLE_CLIPS) clipSelect.add(new Option(name, name));
clipSelect.value = params.get('clip') ?? 'back and forth';
const moveSelect = $<HTMLSelectElement>('move');
moveSelect.value = params.get('move') ?? 'still';

function applyClip(name: string, seconds: number, mix = 1) {
  const clip = loaded?.clips.get(name);
  if (!clip) return;
  clip.instance.time = seconds % clip.duration;
  clip.instance.apply(mix);
}

function renderSlots() {
  const host = $('slots');
  host.replaceChildren();
  for (const slot of slotIds) {
    if (!lylaSlots[slot]) continue;
    const select = document.createElement('select');
    select.dataset['slot'] = slot;
    select.add(new Option('None', ''));
    for (const item of itemsForSlot(items, slot)) select.add(new Option(item.name, item.id));
    select.value = equipped[slot] ?? '';
    select.onchange = () => {
      if (select.value) equipped[slot] = select.value;
      else delete equipped[slot];
      renderTints();
    };
    const label = document.createElement('label');
    label.append(slot, select);
    host.append(label);
  }
}
function renderTints() {
  const host = $('tints');
  host.replaceChildren();
  for (const id of Object.values(equipped)) {
    const spec = id ? items.get(id) : undefined;
    if (!spec) continue;
    for (const [name, tint] of Object.entries(spec.tints)) {
      const input = document.createElement('input');
      input.type = 'color';
      input.value = tints[spec.id]?.[name] ?? tint.default;
      input.oninput = () => ((tints[spec.id] ??= {})[name] = input.value);
      const label = document.createElement('label');
      label.append(`${spec.name} · ${tint.label}`, input);
      host.append(label);
    }
  }
}
renderSlots();
renderTints();
for (const key of ['hair', 'outfit'] as const) {
  const input = $<HTMLInputElement>(key);
  input.value = colours[key];
  let timer = 0;
  input.oninput = () => {
    colours[key] = input.value;
    clearTimeout(timer);
    timer = window.setTimeout(() => void build(), 120);
  };
}

const bounds = { minX: 0, minY: 0, maxX: 600, maxY: 600 };
let clock = Number(params.get('t') ?? 0);
let last: number | null = null;
let frames = 0;
function frame(now: number) {
  try {
    const dt = shot ? 1 / 60 : last === null ? 0 : Math.min(0.1, (now - last) / 1000);
    last = now;
    if (!shot) clock += dt;
    const stage = $('stage');
    const ratio = Math.min(devicePixelRatio || 1, 2);
    const width = stage.clientWidth,
      height = stage.clientHeight;
    for (const canvas of [riveCanvas, back!.canvas, front!.canvas]) {
      const w = Math.round(width * ratio),
        h = Math.round(height * ratio);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
    }
    const board = loaded?.board;
    if (!board) return;
    applyClip('wave Non Looping', 0);
    applyClip('blink_IDLE', shot ? 0.2 : clock % 2);
    applyClip(clipSelect.value, clock);
    applyClip('hair Pink', 0);
    applyClip('clothing green', 0);
    applyClip('glasses blue', 0);
    board.advance(dt);
    // Stage motion: walking bob across the screen, or a drop-in entrance.
    const size = Math.min(height * (shot ? 0.8 : 0.92), width * 1.1);
    if (builtGlasses !== wantGlasses()) void build();
    let cx = width / 2,
      bottom = height * 0.98;
    if (moveSelect.value === 'walk') {
      const phase = (clock % 6) / 6;
      cx = width * (0.2 + 0.6 * (phase < 0.5 ? phase * 2 : 2 - phase * 2));
      bottom -= Math.abs(Math.sin(clock * 7)) * size * 0.025;
    } else if (moveSelect.value === 'enter') {
      const t = Math.min(1, (clock % 3) / 0.8);
      const ease = 1 - Math.pow(1 - t, 3) * Math.cos(t * 6);
      bottom += (1 - ease) * height * 0.8;
    }
    const frameBox = {
      minX: (cx - size / 2) * ratio,
      maxX: (cx + size / 2) * ratio,
      minY: (bottom - size) * ratio,
      maxY: bottom * ratio,
    };
    const view: Affine = viewMatrix(
      runtime,
      runtime.Fit.contain,
      runtime.Alignment.bottomCenter,
      frameBox,
      bounds,
    );
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    renderer.clear();
    renderer.save();
    renderer.align(runtime.Fit.contain, runtime.Alignment.bottomCenter, frameBox, bounds);
    board.draw(renderer);
    renderer.restore();
    renderer.flush();
    for (const ctx of [back!, front!]) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    }
    layer.draw(back, front, {
      view,
      world: riveTransformSource(board),
      equipped,
      tints,
      palette: colours,
      dt,
      still: shot,
    });
    if (params.has('debug')) {
      const world = riveTransformSource(board);
      for (const [slot, binding] of Object.entries(lylaSlots)) {
        const f = slotFrame(binding, world(binding));
        const m = multiply(view, f.matrix);
        front!.setTransform(...m);
        front!.strokeStyle = '#0a0';
        front!.lineWidth = 0.01;
        front!.strokeRect(-0.5, -0.5, 1, 1);
        front!.fillStyle = '#0a0';
        front!.fillRect(-0.02, -0.02, 0.04, 0.04);
        front!.setTransform(1, 0, 0, 1, m[4], m[5]);
        front!.font = '11px sans-serif';
        front!.fillText(slot, 4, -4);
      }
    }
    runtime.resolveAnimationFrame();
    if (++frames === 3) document.body.dataset['ready'] = 'true';
  } catch (error) {
    errorBox.textContent = String(error);
    throw error;
  }
  runtime.requestAnimationFrame(frame);
}
runtime.requestAnimationFrame(frame);
