// Turns a variant spec into in-memory edits of the character file: skin, eye and hair colours,
// hidden built-in hair or glasses, build proportions and face shape. The rig contract (names,
// control tracks, clips, joysticks, soles) is untouched: only setup-pose values and colour keys
// change, and nothing a clip keys is edited (tests/variants.test.ts checks both).
import type { FaceShape, Variant } from '../../../../shared/variants';
import { retarget } from '../../attachments/color';
import { recolorAnimation } from '../../attachments/riv/rivPatch';
import { adjust } from './colorScience';
import { ARGB, browColor, eyePalettes, hairPalette, skinPalette } from './palettes';
import { RigIndex, resolveRig, type ColorRole, type VariantRig } from './rig';
import {
  PROP,
  TYPE,
  componentColor,
  editComponents,
  type FloatEdit,
  type UintEdit,
} from './rivEdit';
import type { RivObject } from '../../attachments/riv/rivBinary';

const PINK = '#d80b4c';
/** Rive BlendMode values (rive-runtime include/rive/shapes/paint/blend_mode.hpp). */
const BLEND_SRC_OVER = 3;
const BLEND_MULTIPLY = 24;
/** Hair colour a variant renders with: the custom colour, else black-brown for new styles. */
export function effectiveHairColor(variant: Variant): string | undefined {
  return variant.hair.color ?? (hidesBuiltInHair(variant) ? DEFAULT_HAIR : undefined);
}
export const DEFAULT_HAIR = '#2a211e';

/** True when the chosen hairstyle replaces the character's built-in hair. */
export function hidesBuiltInHair(variant: Variant) {
  return variant.hair.style !== 'curls' || variant.covering.kind !== 'none';
}

const FACE_VERTEX = { left: 0, bottom: 1, right: 2, top: 3 } as const;
type VertexEdit = Partial<Record<'x' | 'y' | 'in' | 'out', number>> & { scale?: boolean };
/**
 * Face shapes as offsets on the 4-vertex face outline (artboard units; `in`/`out` multiply the
 * Bézier handle lengths). Modest on purpose: eyes, nose and mouth never change.
 */
const faceShapes: Readonly<
  Record<FaceShape, Partial<Record<keyof typeof FACE_VERTEX, VertexEdit>>>
> = {
  round: {},
  'soft-square': {
    left: { y: 4, out: 1.25 },
    right: { y: 4, in: 1.25 },
    bottom: { y: -2, in: 1.4, out: 1.4 },
  },
  oval: {
    left: { x: 4 },
    right: { x: -4 },
    bottom: { y: 7, in: 0.92, out: 0.92 },
    top: { y: -2 },
  },
  heart: {
    left: { y: -6, x: -2 },
    right: { y: -6, x: 2 },
    bottom: { y: 4, in: 0.7, out: 0.7 },
  },
  full: {
    left: { x: -6, out: 1.12 },
    right: { x: 6, in: 1.12 },
    bottom: { y: 2, in: 1.18, out: 1.18 },
  },
};
export const faceWidthFactor: Readonly<Record<FaceShape, number>> = {
  round: 1,
  'soft-square': 1,
  oval: 0.96,
  heart: 1.02,
  full: 1.063,
};

function faceVertices(index: RigIndex, rig: VariantRig): number[] {
  const shape = index
    .select(rig.face.shape)
    .find((i) => index.components[i]?.typeKey === TYPE.shape);
  if (shape === undefined) throw new Error(`${rig.character}: face shape not found`);
  const path = index.components.findIndex(
    (_, i) => index.parent(i) === shape && i !== shape && index.name(i) === 'Path',
  );
  const vertices: number[] = [];
  index.components.forEach((_, i) => {
    if (index.parent(i) === path) vertices.push(i);
  });
  if (vertices.length !== 4) throw new Error(`${rig.character}: face outline must have 4 vertices`);
  return vertices;
}

/** Edits for one variant (exported for tests). */
export function variantEdits(bytes: Uint8Array, rig: VariantRig, variant: Variant) {
  const index = new RigIndex(bytes, rig.artboard);
  const resolved = resolveRig(rig, index);
  const colors = new Map<number, number>();
  const set = (role: ColorRole, hex: string, alpha = 255) => {
    for (const i of resolved.colors[role]) colors.set(i, ARGB(hex, alpha));
  };
  if (variant.skin.tone !== 'original') {
    const skin = skinPalette(variant.skin.tone, variant.skin.undertone);
    set('skin', skin.base);
    set('skinShade', skin.shade);
    // The face gradient spans the whole face: a gentle lift, like the original's, not the full
    // highlight (a strong gradient reads as a dark lower face on deep tones).
    set('skinHighlight', adjust(skin.base, { dl: 0.04, dh: 3 }));
    // Lids sit at eye height, where the face gradient is about halfway to its light end.
    set('skinLid', adjust(skin.base, { dl: 0.02, dh: 1.5 }));
    set('nose', skin.nose);
    set('mouth', skin.mouth);
    set('blush', skin.blush, variant.features.blush ? 0x4c : 0);
  } else if (!variant.features.blush) set('blush', '#ffb5e2', 0);
  if (variant.eyes !== 'teal') {
    const eyes = eyePalettes[variant.eyes];
    set('irisDark', eyes.dark);
    set('irisLight', eyes.light);
  }
  if (variant.features.prosthetic !== 'none') {
    const hand = rig.hands[variant.features.prosthetic];
    const shade = adjust(variant.features.prostheticColor, { dl: -0.12 });
    const creases = new Set(resolved.colors.skinShade);
    for (const i of index.colorsOf(hand))
      colors.set(i, ARGB(creases.has(i) ? shade : variant.features.prostheticColor));
  }
  const hideHair = hidesBuiltInHair(variant);
  const hair = effectiveHairColor(variant);
  if (hideHair) for (const i of resolved.hairColors) colors.set(i, 0x00000000);
  else if (hair)
    for (const i of resolved.hairColors) {
      const stored = componentColor(index.components[i] as RivObject) ?? 0;
      colors.set(i, retarget(stored, PINK, hairPalette(hair).base));
    }
  if (hair) for (const i of resolved.browColors) colors.set(i, ARGB(browColor(hair)));

  const floats: FloatEdit[] = [];
  if (variant.build !== 'average')
    for (const edit of rig.builds[variant.build]) {
      const targets = index.select(edit.target);
      if (!targets.length) throw new Error(`${rig.character}: build target ${edit.target.name}`);
      for (const target of targets) {
        if (edit.property === 'thickness') {
          for (const stroke of index.components.keys())
            if (
              index.parent(stroke) === target &&
              index.components[stroke]?.typeKey === TYPE.stroke
            )
              floats.push({
                index: stroke,
                property: PROP.thickness,
                value: (v) => v * edit.amount,
              });
        } else if (edit.property === 'x' || edit.property === 'y')
          floats.push({
            index: target,
            property: PROP[edit.property],
            value: (v) => v + edit.amount,
          });
        else
          floats.push({
            index: target,
            property: PROP[edit.property],
            value: (v) => v * edit.amount,
          });
      }
    }
  const shape = faceShapes[variant.face];
  if (Object.keys(shape).length) {
    const vertices = faceVertices(index, rig);
    for (const [corner, edit] of Object.entries(shape) as [
      keyof typeof FACE_VERTEX,
      VertexEdit,
    ][]) {
      const vertex = vertices[FACE_VERTEX[corner]];
      if (vertex === undefined) continue;
      if (edit.x)
        floats.push({ index: vertex, property: PROP.vertexX, value: (v) => v + (edit.x ?? 0) });
      if (edit.y)
        floats.push({ index: vertex, property: PROP.vertexY, value: (v) => v + (edit.y ?? 0) });
      if (edit.in)
        floats.push({ index: vertex, property: PROP.inDistance, value: (v) => v * (edit.in ?? 1) });
      if (edit.out)
        floats.push({
          index: vertex,
          property: PROP.outDistance,
          value: (v) => v * (edit.out ?? 1),
        });
    }
    const width = faceWidthFactor[variant.face];
    if (width !== 1)
      for (const selector of rig.ears)
        for (const ears of index.select(selector))
          floats.push({ index: ears, property: PROP.scaleX, value: (v) => v * width });
  }
  // The mascot's blush multiplies (made for its pink skin), which darkens deep tones into
  // shadows under the eyes; human tones use normal blending with a rosy colour instead.
  const uints: UintEdit[] = [];
  if (variant.skin.tone !== 'original')
    index.components.forEach((component, fill) => {
      if (
        component.typeKey === TYPE.fill &&
        resolved.colors.blush.some((color) => index.parent(color) === fill) &&
        component.props.get(PROP.paintBlendMode) === BLEND_MULTIPLY
      )
        uints.push({ index: fill, property: PROP.paintBlendMode, value: BLEND_SRC_OVER });
    });
  return { colors, floats, uints, resolved, hideHair };
}

/** Applies a variant to the character file in memory. The original variant returns the input. */
export function applyVariant(bytes: Uint8Array, rig: VariantRig, variant: Variant): Uint8Array {
  const { colors, floats, uints, resolved, hideHair } = variantEdits(bytes, rig, variant);
  let out = editComponents(bytes, rig.artboard, { colors, floats, uints });
  // Hair colour animations key the hair and brow colours every frame: rewrite their keys too.
  const hairSet = new Set(resolved.hairColors);
  const brows = new Set(resolved.browColors);
  const custom = effectiveHairColor(variant);
  const brow = custom ? ARGB(browColor(custom)) : undefined;
  if (hideHair || custom)
    for (const animation of rig.hair.animations)
      out = recolorAnimation(out, rig.artboard, animation.name, (argb, key) => {
        if (brows.has(key.objectIndex)) return brow ?? argb;
        if (!hairSet.has(key.objectIndex)) return argb;
        if (hideHair) return argb & 0x00ffffff;
        return custom ? retarget(argb, animation.base, hairPalette(custom).base) : argb;
      });
  if (!variant.features.glasses)
    for (const animation of rig.glasses)
      out = recolorAnimation(out, rig.artboard, animation, (argb) => argb & 0x00ffffff);
  return out;
}
