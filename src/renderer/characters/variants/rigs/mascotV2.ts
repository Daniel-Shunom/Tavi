// Variant rig for Lyla v2 (src/renderer/characters/mascot-v2, built from the remix in
// art/mascot-remix/ by tools/mascot-remix/). Everything is selected by the names the CLI build
// keeps, so the rig contract (docs/character/RIG-SPEC.md section 1b) is untouched: variants
// only recolour fills, scale a few setup-pose values that no clip keys, and hide the built-in
// hair shapes when another hairstyle or a head covering is chosen.
import type { VariantRig } from '../rig';

const arms = [
  { name: 'arm', under: 'ARM RIGHT' },
  { name: 'arm', under: 'ARM LEFT' },
  { name: 'arm_2' },
];
const legs = [{ name: 'right leg' }];

export const mascotV2VariantRig: VariantRig = {
  character: 'mascot-v2',
  artboard: 'lyla animation',
  colors: {
    skin: [
      { name: 'face', stop: 0 },
      { name: 'lid' },
      { name: 'lid_2' },
      { name: 'lower lid' },
      { name: 'lower lid 2' },
      { name: 'ear', under: 'head', stop: 1 },
      ...arms,
      ...legs,
      { name: 'tavi/handL' },
      { name: 'tavi/handR' },
    ],
    skinShade: [{ name: 'neck' }, { name: 'ear', under: 'head', stop: 0 }, { name: 'crease' }],
    skinHighlight: [{ name: 'face', stop: 1 }],
    blush: [{ name: 'blush' }],
    nose: [{ name: 'nose' }],
    // The mouth is being rebuilt as a shape library; recolour it only while it exists.
    mouth: [{ name: 'mouth', optional: true }],
    irisDark: [
      { name: 'pupil', stop: 0 },
      { name: 'pupil_2', stop: 0 },
    ],
    irisLight: [
      { name: 'pupil', stop: 1 },
      { name: 'pupil_2', stop: 1 },
    ],
  },
  hair: {
    shapes: [
      { name: 'bangs move' },
      { name: 'hair side pieces' },
      { name: 'hair BACK' },
      { name: 'Ellipse 30' },
    ],
    animations: [
      { name: 'hair Pink', base: '#d80b4c' },
      { name: 'hair Orange', base: '#d97357' },
      { name: 'hair Brown', base: '#8e3821' },
    ],
    brows: [{ name: 'brow_left' }, { name: 'brow_right' }],
  },
  glasses: ['glasses blue', 'glasses white', 'glasses grey'],
  // Torso, hip line, shoulder spacing and limb thickness. Legs, feet, hips height and the head
  // are untouched, so soles, seat height and body-state contacts stay valid for every build.
  builds: {
    slim: [
      { target: { name: 'shirt' }, property: 'scaleX', amount: 0.88 },
      { target: { name: 'pant base' }, property: 'scaleX', amount: 0.9 },
      { target: { name: 'neck' }, property: 'scaleX', amount: 0.92 },
      { target: { name: 'tavi/armR' }, property: 'x', amount: -2.5 },
      { target: { name: 'tavi/armL' }, property: 'x', amount: 2.5 },
      { target: { name: 'arm_2' }, property: 'x', amount: 2.5 },
      ...arms.map((target) => ({ target, property: 'thickness' as const, amount: 0.86 })),
      ...legs.map((target) => ({ target, property: 'thickness' as const, amount: 0.88 })),
    ],
    broad: [
      { target: { name: 'shirt' }, property: 'scaleX', amount: 1.16 },
      { target: { name: 'pant base' }, property: 'scaleX', amount: 1.08 },
      { target: { name: 'neck' }, property: 'scaleX', amount: 1.12 },
      { target: { name: 'tavi/armR' }, property: 'x', amount: 4.5 },
      { target: { name: 'tavi/armL' }, property: 'x', amount: -4.5 },
      { target: { name: 'arm_2' }, property: 'x', amount: -4.5 },
      ...arms.map((target) => ({ target, property: 'thickness' as const, amount: 1.14 })),
      ...legs.map((target) => ({ target, property: 'thickness' as const, amount: 1.1 })),
    ],
    full: [
      { target: { name: 'shirt' }, property: 'scaleX', amount: 1.3 },
      { target: { name: 'shirt' }, property: 'scaleY', amount: 1.04 },
      { target: { name: 'pant base' }, property: 'scaleX', amount: 1.3 },
      { target: { name: 'neck' }, property: 'scaleX', amount: 1.2 },
      { target: { name: 'tavi/armR' }, property: 'x', amount: 7 },
      { target: { name: 'tavi/armL' }, property: 'x', amount: -7 },
      { target: { name: 'arm_2' }, property: 'x', amount: -7 },
      ...arms.map((target) => ({ target, property: 'thickness' as const, amount: 1.32 })),
      ...legs.map((target) => ({ target, property: 'thickness' as const, amount: 1.3 })),
    ],
  },
  face: {
    shape: { name: 'face' },
  },
  ears: [{ name: 'ear move' }],
  anchors: {
    head: { name: 'head', kind: 'node' },
    face: { name: 'face features move', kind: 'node' },
    hairBack: { name: 'hair squash', kind: 'node' },
    hairLeft: { name: 'hair left swing', kind: 'bone' },
    hairRight: { name: 'hair right swing', kind: 'bone' },
    upper: { name: 'tavi/upper', kind: 'node' },
    forearmL: { name: 'tavi/armL.fore', kind: 'bone' },
    forearmR: { name: 'tavi/armR.fore', kind: 'bone' },
  },
  hands: { left: { name: 'tavi/handL' }, right: { name: 'tavi/handR' } },
  // Measured in the runtime rest pose (tools/variants/measure.html), relative to `head`.
  head: {
    faceCenter: [1, -92],
    faceRadius: [95, 93],
    eyeY: -94,
    browY: -125,
    ear: [105, -80],
  },
};
