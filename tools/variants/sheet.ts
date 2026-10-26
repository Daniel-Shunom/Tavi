// Variant contact sheet: every preset and hairstyle rendered through the app's own renderer
// (createCharacterRenderer + the variant overlay layer), at large and overlay size, performing
// motion-library expressions and a walk through the shared Lyla v2 motion binding, over light,
// dark, mid-grey and saturated backgrounds. Serve the repo with Vite and open
// /tools/variants/sheet.html (?only=presets|hair|ramp). shoot.mjs screenshots it.
import { characters } from '../../src/renderer/characters/registry';
import { createCharacterRenderer } from '../../src/renderer/adapter';
import { mascotV2Motion } from '../../src/renderer/characters/mascot-v2/motion';
import { mascotMotion } from '../../src/renderer/characters/mascot/motion';
import type { CharacterManifest } from '../../src/renderer/characters/manifest';
import type { VariantRig } from '../../src/renderer/characters/variants/rig';
import { variantRigs } from '../../src/renderer/characters/variantRigs';
import { createVariantLayer } from '../../src/renderer/characters/variants/overlay/layer';
import { hairStyleLabels } from '../../src/renderer/characters/variants/overlay/hairstyles';
import { coveringLabels } from '../../src/renderer/characters/variants/overlay/features';
import { skinPalette, skinRamp } from '../../src/renderer/characters/variants/palettes';
import { MotionLayer } from '../../src/renderer/motion/motion';
import type { MotionFrame } from '../../src/renderer/motion/types';
import {
  hairStyles,
  faceShapes,
  headCoverings,
  originalVariant,
  undertones,
  withChanges,
  type Variant,
} from '../../shared/variants';
import { describeVariant, variantPresets } from '../../shared/variantPresets';

const manifest = characters.get('mascot-v2');
const rig = variantRigs['mascot-v2'];
if (!manifest || !rig) throw new Error('mascot-v2 variant rig missing');
const params = new URLSearchParams(location.search);
const only = params.get('only');
const BACKGROUNDS = ['#f3f1ec', '#1d1b22', '#7d8088', '#2f8f4e', '#d8452f'];

type Shot =
  | { kind: 'rest' }
  | { kind: 'express'; id: string; at: number }
  | { kind: 'walk'; at: number; direction?: -1 | 1 }
  | { kind: 'turn'; value: number };

/** Runs the motion layer to `shot` and returns its frame (deterministic, 60 fps). */
function motionFrame(shot: Shot, character = manifest): MotionFrame {
  const layer = new MotionLayer(
    7,
    { personality: 'playful', attitude: 'cheeky', energy: 60, reducedMotion: false, quiet: false },
    { aspect: 16 / 9, bodyHeight: 0.3, margin: 0.02 },
    { feet: true, turnStyle: character?.turnStyle },
  );
  const direction = shot.kind === 'walk' ? (shot.direction ?? 1) : 1;
  layer.place(direction > 0 ? 0.3 : 0.7, 0.9);
  if (shot.kind === 'express') layer.express(shot.id, { at: 0.2, intensity: 1, hold: 3 });
  if (shot.kind === 'walk') {
    layer.attend({ x: direction * 0.9, y: -0.1 });
    layer.moveTo({ x: direction > 0 ? 0.8 : 0.2, at: 0.2, gait: 'step' });
  }
  const end = shot.kind === 'rest' || shot.kind === 'turn' ? 1 : shot.at;
  let frame = layer.update(0);
  for (let t = 1 / 60; t <= end; t += 1 / 60) frame = layer.update(t);
  if (shot.kind === 'turn') {
    frame.pose.turnHead = shot.value;
    frame.pose.turnBody = shot.value;
  }
  return frame;
}

interface Card {
  label: string;
  shot: Shot;
  /** Artboard height in CSS px (300 shows the body at about 220 px). */
  size: number;
  background: string;
  crop?: 'head';
}

async function renderVariant(
  variant: Variant,
  cards: Card[],
  character: CharacterManifest = manifest!,
  variantRig: VariantRig | null = rig,
): Promise<HTMLCanvasElement[]> {
  const width = Math.max(...cards.map((c) => c.size)) * 0.9,
    height = Math.max(...cards.map((c) => c.size));
  const gl = document.createElement('canvas');
  const back = document.createElement('canvas'),
    front = document.createElement('canvas');
  for (const c of [gl, back, front]) {
    c.width = width;
    c.height = height;
  }
  const renderer = await createCharacterRenderer(gl, character, { look: { variant } });
  renderer.resize(width, height);
  const overlay = variantRig
    ? createVariantLayer({ rig: variantRig, variant, path: (d) => new Path2D(d) })
    : null;
  const binding = character.id === 'mascot-v2' ? mascotV2Motion : mascotMotion;
  let faceX = 0;
  const backCtx = back.getContext('2d'),
    frontCtx = front.getContext('2d');
  if (!backCtx || !frontCtx) throw new Error('2d context');
  renderer.setDecorator?.((view, world, dt) => {
    for (const ctx of [backCtx, frontCtx]) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, width, height);
    }
    overlay?.draw(backCtx, frontCtx, { view, world, dt });
    const face = world({
      node: 'face features move',
      kind: 'node',
      offset: [0, 0],
      size: 1,
      follow: 1,
      rotation: 0,
    });
    faceX = face?.[4] ?? 0;
  });
  const out: HTMLCanvasElement[] = [];
  for (const card of cards) {
    const frame = motionFrame(card.shot, character);
    const bound = binding.bind(frame);
    const placement = { x: width / 2, y: height * 0.99, width, height: card.size, rotation: 0 };
    // Settle springs and the captured rest pose at rest first, then step into the pose.
    overlay?.recapture();
    const rest = binding.bind(motionFrame({ kind: 'rest' }, character));
    renderer.applyFrame({ tracks: rest.tracks, inputs: {}, nodes: rest.nodes });
    renderer.draw(1 / 60, placement);
    for (let i = 0; i < 4; i++) {
      renderer.applyFrame({ tracks: bound.tracks, inputs: {}, nodes: bound.nodes });
      renderer.draw(1 / 60, placement);
    }
    const target = document.createElement('canvas');
    target.width = card.crop === 'head' ? 300 : Math.round(card.size * 0.8);
    target.height = card.crop === 'head' ? 300 : Math.round(card.size * 1.0);
    const ctx = target.getContext('2d');
    if (!ctx) continue;
    ctx.fillStyle = card.background;
    ctx.fillRect(0, 0, target.width, target.height);
    const dx = (target.width - width) / 2,
      dy = target.height - height;
    for (const layer of [back, gl, front]) {
      if (card.crop === 'head') {
        const side = card.size * 0.52;
        ctx.drawImage(layer, (width - side) / 2, height * 0.18, side, side, 0, 0, 300, 300);
      } else ctx.drawImage(layer, dx, dy);
    }
    target.title = card.label;
    target.dataset.faceX = String(faceX);
    target.dataset.turnHead = String(frame.pose.turnHead);
    target.dataset.turnBody = String(frame.pose.turnBody);
    target.dataset.gazeX = String(frame.pose.gazeX);
    target.dataset.character = character.id;
    out.push(target);
  }
  renderer.dispose();
  return out;
}

function section(title: string, note: string) {
  const el = document.createElement('section');
  el.innerHTML = `<h2>${title}</h2><p class="note">${note}</p>`;
  document.body.append(el);
  return el;
}

function row(
  parent: HTMLElement,
  title: string,
  subtitle: string,
  canvases: HTMLCanvasElement[],
  id: string,
) {
  const el = document.createElement('div');
  el.className = 'row';
  el.dataset.row = id;
  const label = document.createElement('div');
  label.className = 'label';
  label.innerHTML = `<strong>${title}</strong><span>${subtitle}</span>`;
  el.append(label);
  for (const canvas of canvases) {
    const figure = document.createElement('figure');
    figure.append(canvas);
    const caption = document.createElement('figcaption');
    caption.textContent = canvas.title;
    figure.append(caption);
    el.append(figure);
  }
  parent.append(el);
}

const performanceCards = (size: number): Card[] => [
  {
    label: 'rest (large)',
    shot: { kind: 'rest' },
    size: 420,
    background: BACKGROUNDS[0] ?? '#fff',
  },
  { label: 'rest Â· 220 px', shot: { kind: 'rest' }, size, background: BACKGROUNDS[1] ?? '#000' },
  {
    label: 'celebrate',
    shot: { kind: 'express', id: 'celebrate', at: 0.9 },
    size,
    background: BACKGROUNDS[2] ?? '#888',
  },
  {
    label: 'skeptical',
    shot: { kind: 'express', id: 'skeptical', at: 1.1 },
    size,
    background: BACKGROUNDS[0] ?? '#fff',
  },
  {
    label: 'surprise',
    shot: { kind: 'express', id: 'surprise', at: 0.5 },
    size,
    background: BACKGROUNDS[3] ?? '#0a0',
  },
  {
    label: 'wave',
    shot: { kind: 'express', id: 'wave', at: 0.9 },
    size,
    background: BACKGROUNDS[4] ?? '#a00',
  },
  { label: 'walk 1', shot: { kind: 'walk', at: 0.75 }, size, background: BACKGROUNDS[1] ?? '#000' },
  { label: 'walk 2', shot: { kind: 'walk', at: 0.95 }, size, background: BACKGROUNDS[2] ?? '#888' },
];

async function presets() {
  const el = section(
    'Variants',
    'Presets through the real renderer: large rest, then overlay size (artboard 300 px, body about 220 px) performing motion-library expressions and a walk with the shared Lyla v2 binding.',
  );
  for (const variant of variantPresets) {
    const canvases = await renderVariant(variant, performanceCards(300));
    row(
      el,
      variant.preset ?? 'variant',
      describeVariant(variant, {
        hair: hairStyleLabels[variant.hair.style],
        covering: coveringLabels[variant.covering.kind],
      }),
      canvases,
      variant.preset ?? 'variant',
    );
  }
}

async function hair() {
  const el = section(
    'Hairstyles and head coverings',
    'Each style on the same base (Tone 6, average build), large and at overlay size, plus a walk frame and a celebration (springs and side bones).',
  );
  const base = withChanges(originalVariant, {
    skin: { tone: '6', undertone: 'warm' },
    eyes: 'brown',
    features: { glasses: false },
  });
  const cards = (size: number): Card[] => [
    { label: 'large', shot: { kind: 'rest' }, size: 420, background: BACKGROUNDS[0] ?? '#fff' },
    {
      label: '220 px Â· light',
      shot: { kind: 'rest' },
      size,
      background: BACKGROUNDS[0] ?? '#fff',
    },
    { label: '220 px Â· dark', shot: { kind: 'rest' }, size, background: BACKGROUNDS[1] ?? '#000' },
    { label: 'walk', shot: { kind: 'walk', at: 0.85 }, size, background: BACKGROUNDS[2] ?? '#888' },
    {
      label: 'celebrate',
      shot: { kind: 'express', id: 'celebrate', at: 0.9 },
      size,
      background: BACKGROUNDS[3] ?? '#0a0',
    },
  ];
  for (const style of hairStyles) {
    const color = style === 'curls' ? undefined : '#2a211e';
    const variant = withChanges(base, { hair: color ? { style, color } : { style } });
    row(
      el,
      hairStyleLabels[style],
      style,
      await renderVariant(variant, cards(300)),
      `hair-${style}`,
    );
  }
  for (const kind of headCoverings.filter((k) => k !== 'none')) {
    const variant = withChanges(base, { covering: { kind, color: '#4f68b0' } });
    row(el, coveringLabels[kind], kind, await renderVariant(variant, cards(300)), `cover-${kind}`);
  }
}

async function ramp() {
  const el = section(
    'Skin ramp',
    'Tones 1â€“10 with each undertone: base, shade, highlight, and the face at overlay size.',
  );
  for (const undertone of undertones) {
    const canvases: HTMLCanvasElement[] = [];
    for (const tone of Object.keys(skinRamp) as (keyof typeof skinRamp)[]) {
      const p = skinPalette(tone, undertone);
      const swatch = document.createElement('canvas');
      swatch.width = 90;
      swatch.height = 60;
      const ctx = swatch.getContext('2d');
      if (!ctx) continue;
      [p.base, p.shade, p.highlight].forEach((c, i) => {
        ctx.fillStyle = c;
        ctx.fillRect(i * 30, 0, 30, 36);
      });
      ctx.fillStyle = p.mouth;
      ctx.fillRect(0, 36, 30, 24);
      ctx.fillStyle = p.nose;
      ctx.fillRect(30, 36, 30, 24);
      ctx.fillStyle = p.blush;
      ctx.fillRect(60, 36, 30, 24);
      swatch.title = `Tone ${tone}`;
      canvases.push(swatch);
    }
    row(
      el,
      undertone,
      'base Â· shade Â· highlight / mouth Â· nose Â· blush',
      canvases,
      `ramp-${undertone}`,
    );
    const faces: HTMLCanvasElement[] = [];
    for (const tone of Object.keys(skinRamp) as (keyof typeof skinRamp)[]) {
      const variant = withChanges(originalVariant, {
        skin: { tone, undertone },
        eyes: 'dark-brown',
        hair: { style: 'afro', color: '#2a211e' },
        features: { glasses: false },
      });
      const [canvas] = await renderVariant(variant, [
        {
          label: `Tone ${tone}`,
          shot: { kind: 'express', id: 'happy', at: 0.8 },
          size: 300,
          background: BACKGROUNDS[tone === '1' ? 1 : 0] ?? '#fff',
        },
      ]);
      if (canvas) faces.push(canvas);
    }
    row(el, `${undertone} Â· faces`, 'overlay size', faces, `faces-${undertone}`);
  }
}

async function main() {
  if (only === 'travel') {
    const el = section(
      'Target-directed travel',
      'Eyes and head lead toward the target, body follows, then the character returns to camera on arrival. Both travel directions use the real motion layer.',
    );
    for (const style of ['locs', 'simple-locs', 'cornrows', 'taper'] as const)
      for (const direction of [-1, 1] as const) {
        const cards: Card[] = [0.4, 0.8, 1.3, 12].map((at) => ({
          label: `${at}s, target ${direction < 0 ? 'left' : 'right'}`,
          shot: { kind: 'walk', at, direction },
          size: 420,
          background: '#f3f1ec',
        }));
        const variant = withChanges(originalVariant, {
          skin: { tone: '6' },
          hair: { style, color: '#2a211e' },
          features: { glasses: false },
        });
        row(
          el,
          hairStyleLabels[style],
          `target ${direction < 0 ? 'left' : 'right'}`,
          await renderVariant(variant, cards),
          `travel-${style}-${direction < 0 ? 'left' : 'right'}`,
        );
      }
  }
  if (only === 'fitting') {
    const el = section(
      'Hairline and feature fitting',
      'Close views of the four requested styles on every face shape at light and deep tones, both turn directions. Inspect roots, seams, ears, glasses, cheek features and silhouette intersections.',
    );
    const cards: Card[] = [-1, -0.6, 0, 0.6, 1].map((value) => ({
      label: `turn ${value}`,
      shot: { kind: 'turn', value },
      size: 720,
      background: '#f3f1ec',
      crop: 'head',
    }));
    for (const style of ['locs', 'simple-locs', 'cornrows', 'taper'] as const)
      for (const face of faceShapes)
        for (const tone of ['2', '9'] as const) {
          const variant = withChanges(originalVariant, {
            skin: { tone, undertone: 'warm' },
            face,
            hair: { style, color: '#2a211e' },
            features: { glasses: true, freckles: true, hearingAids: 'both' },
          });
          row(
            el,
            hairStyleLabels[style],
            `${face}, tone ${tone}, glasses + freckles + hearing aids`,
            await renderVariant(variant, cards),
            `fit-${style}-${face}-${tone}`,
          );
        }
  }
  if (only === 'characters') {
    const el = section(
      'Registered characters',
      'Both selectable base characters at rest and walking. Lyla v1 has no authored turn or custom variant rig.',
    );
    for (const character of characters.values())
      row(
        el,
        character.name,
        `turn style: ${character.turnStyle}`,
        await renderVariant(
          originalVariant,
          performanceCards(300),
          character,
          variantRigs[character.id] ?? null,
        ),
        `character-${character.id}`,
      );
  }
  if (only === 'turns') {
    const el = section(
      'Directional fitting',
      'Explicit authored turns, camera-facing centre, both sides at travel and full range.',
    );
    const cards: Card[] = [-1, -0.6, 0, 0.6, 1].map((value) => ({
      label: `turn ${value}`,
      shot: { kind: 'turn', value },
      size: 420,
      background: '#f3f1ec',
    }));
    for (const variant of variantPresets)
      row(
        el,
        variant.preset ?? 'variant',
        describeVariant(variant, {
          hair: hairStyleLabels[variant.hair.style],
          covering: coveringLabels[variant.covering.kind],
        }),
        await renderVariant(variant, cards),
        `turn-${variant.preset ?? 'variant'}`,
      );
    for (const style of hairStyles) {
      const variant = withChanges(originalVariant, {
        skin: { tone: '6', undertone: 'warm' },
        hair: { style, color: '#2a211e' },
        features: { glasses: false },
      });
      row(
        el,
        hairStyleLabels[style],
        style,
        await renderVariant(variant, cards),
        `turn-hair-${style}`,
      );
    }
  }
  if (!only || only === 'presets') await presets();
  if (!only || only === 'hair') await hair();
  if (!only || only === 'ramp') await ramp();
  document.body.dataset.ready = '1';
}
main().catch((error: unknown) => {
  console.error(error);
  document.body.dataset.error = String(error instanceof Error ? error.stack : error);
});
