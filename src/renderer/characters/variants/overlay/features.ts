// Face and body features (freckles, vitiligo, smile lines, facial hair, hearing aids, a prosthetic
// forearm) and head coverings, as shape sets. Features are everyday details, drawn small and in
// the character's own palette; none is ever referenced by a reaction (VARIANTS-RESEARCH.md).
// Face features follow `face features move` so they track gaze; hands follow the forearm bones.
import type { HeadCovering, Variant } from '../../../../../shared/variants';
import { P, blob, ellipse, rng, smoothClosed, smoothOpen, type Pt } from './geometry';
import type { OverlayLayer, ShapeSet } from './types';

const FACE = { cx: 1, cy: -92, rx: 95, ry: 93 };
const MOUTH: Pt = [1, -40];

function freckles(): OverlayLayer {
  const random = rng(17);
  let d = '';
  for (const side of [-1, 1])
    for (let i = 0; i < 8; i++) {
      const x = side * (30 + random() * 32),
        y = -70 + random() * 22;
      d += ellipse(x, y, 1.9 + random() * 0.9, 1.7 + random() * 0.8);
    }
  for (const x of [-9, -2, 6]) d += ellipse(x, -73 + Math.abs(x) * 0.2, 1.6, 1.5);
  return { d, fill: { slot: 'freckle', alpha: 0.8 }, follow: 'face' };
}

/** Non-segmental vitiligo: roughly symmetric patches around the eyes and mouth, on skin only. */
function vitiligoFace(): OverlayLayer {
  const d =
    blob(-84, -64, 11, 15, 3, 9) +
    blob(84, -104, 9, 13, 4, 9) +
    blob(-25, -26, 11, 7, 5, 8) +
    blob(27, -27, 9, 6, 6, 8) +
    blob(-36, -158, 15, 9, 7, 8) +
    blob(6, -9, 12, 6, 8, 8);
  return { d, fill: { slot: 'vitiligo' }, follow: 'face' };
}

/**
 * The skinned arm stroke sits a few units off its forearm bone's axis, toward the body; the bone
 * normal points opposite ways on the two sides (measured on the contact sheet).
 */
const ARM_INSET = { forearmL: -6, forearmR: 11 } as const;

/** Patches on the hands and wrists (forearm bone space: x along the bone, hand from ~47). */
function vitiligoHands(): OverlayLayer[] {
  return (['forearmL', 'forearmR'] as const).map((follow, i) => ({
    d:
      blob(26, ARM_INSET[follow], 7, 4, 20 + i, 7) +
      blob(38, ARM_INSET[follow] * 0.9, 5, 3.6, 30 + i, 7),
    fill: { slot: 'vitiligo' },
    follow,
    space: 'anchor',
  }));
}

function smileLines(): OverlayLayer {
  return {
    d:
      smoothOpen([
        [-22, -60],
        [-30, -50],
        [-27, -38],
      ]) +
      smoothOpen([
        [24, -60],
        [32, -50],
        [29, -38],
      ]),
    stroke: { slot: 'line', width: 2.2, alpha: 0.45 },
    follow: 'face',
  };
}

function facialHair(kind: Variant['features']['facialHair']): OverlayLayer[] {
  if (kind === 'none') return [];
  const moustache = smoothClosed([
    [-24, -46],
    [-12, -53],
    [1, -50],
    [14, -53],
    [26, -46],
    [14, -45],
    [1, -47],
    [-12, -45],
  ]);
  if (kind === 'moustache') return [{ d: moustache, fill: { slot: 'hair' }, follow: 'face' }];
  // Jaw band from ear to ear, around the chin, with the mouth left clear.
  const jaw = smoothClosed([
    [-92, -76],
    [-84, -36],
    [-56, -6],
    [1, 6],
    [58, -6],
    [86, -36],
    [94, -76],
    [80, -62],
    [56, -34],
    [30, -26],
    [1, -24],
    [-28, -26],
    [-54, -34],
    [-78, -62],
  ]);
  if (kind === 'stubble')
    return [
      { d: jaw, fill: { slot: 'hair', alpha: 0.26 }, follow: 'face' },
      { d: moustache, fill: { slot: 'hair', alpha: 0.26 }, follow: 'face' },
    ];
  const beard = smoothClosed([
    [-94, -80],
    [-90, -30],
    [-64, 6],
    [1, 20],
    [66, 6],
    [92, -30],
    [96, -80],
    [80, -60],
    [52, -36],
    [28, -30],
    [1, -28],
    [-26, -30],
    [-50, -36],
    [-78, -60],
  ]);
  return [
    { d: beard, fill: { slot: 'hair' }, follow: 'face' },
    {
      d: smoothOpen([
        [-50, -8],
        [1, 6],
        [52, -8],
      ]),
      stroke: { slot: 'hairShade', width: 3 },
      follow: 'face',
    },
    { d: moustache, fill: { slot: 'hair' }, follow: 'face' },
  ];
}

/** Behind-the-ear hearing aid: a small rounded body over the ear's upper back edge and a tube. */
function hearingAid(side: -1 | 1): OverlayLayer[] {
  const x = side * 105;
  const body = smoothClosed([
    [x + side * 6, -108],
    [x + side * 15, -102],
    [x + side * 16, -80],
    [x + side * 10, -74],
    [x + side * 7, -90],
  ]);
  return [
    { d: body, fill: { slot: 'device' } },
    {
      d: smoothOpen([
        [x + side * 8, -104],
        [x + side * 2, -100],
        [x - side * 4, -88],
      ]),
      stroke: { slot: 'deviceShade', width: 2.2 },
    },
    { d: ellipse(x - side * 4, -87, 2.6, 2.6), fill: { slot: 'deviceShade' } },
  ];
}

/** Prosthetic forearm: a sleeve over the forearm (bone space) with a socket band; the hand is
 * recoloured to match by the file edit. `width` follows the build's limb thickness. */
function prosthetic(side: 'left' | 'right', width: number): OverlayLayer[] {
  const follow = side === 'left' ? 'forearmL' : 'forearmR';
  const w = width / 2;
  const o = ARM_INSET[follow];
  return [
    {
      d: `M${P([4, -w + o])}L${P([44, -w * 0.86 + o])}A${String(w * 0.86)} ${String(w * 0.86)} 0 0 1 ${P([44, w * 0.86 + o])}L${P([4, w + o])}Z`,
      fill: { slot: 'prosthetic' },
      follow,
      space: 'anchor',
    },
    {
      d: `M${P([3, -w - 1 + o])}L${P([11, -w - 1 + o])}L${P([11, w + 1 + o])}L${P([3, w + 1 + o])}Z`,
      fill: { slot: 'prostheticShade' },
      follow,
      space: 'anchor',
    },
    {
      d: `M${P([18, -w * 0.4 + o])}L${P([38, -w * 0.36 + o])}`,
      stroke: { slot: 'white', width: 2, alpha: 0.35 },
      follow,
      space: 'anchor',
    },
  ];
}

/** Arm stroke width (artboard units) per build, for the prosthetic sleeve. */
const armWidth = { slim: 11.5, average: 13.4, broad: 15.3, full: 17.7 } as const;

export function featureShapes(variant: Variant): ShapeSet {
  const f = variant.features;
  const layers: OverlayLayer[] = [];
  if (f.vitiligo === 'face' || f.vitiligo === 'face-hands') layers.push(vitiligoFace());
  if (f.vitiligo === 'hands' || f.vitiligo === 'face-hands') layers.push(...vitiligoHands());
  if (f.freckles) layers.push(freckles());
  if (variant.age === 'elder') layers.push(smileLines());
  layers.push(...facialHair(f.facialHair));
  if (variant.covering.kind !== 'hijab') {
    if (f.hearingAids === 'left' || f.hearingAids === 'both') layers.push(...hearingAid(-1));
    if (f.hearingAids === 'right' || f.hearingAids === 'both') layers.push(...hearingAid(1));
  }
  if (f.prosthetic !== 'none') layers.push(...prosthetic(f.prosthetic, armWidth[variant.build]));
  return { layers };
}

// --- head coverings --------------------------------------------------------------------------

function hijab(): ShapeSet {
  const outer = smoothClosed([
    [-70, 52],
    [-110, 20],
    [-134, -60],
    [-124, -150],
    [-84, -206],
    [1, -226],
    [86, -206],
    [120, -150],
    [124, -60],
    [106, 20],
    [72, 52],
    [1, 62],
  ]);
  const opening = ellipse(FACE.cx, -84, 84, 90);
  return {
    layers: [
      {
        d: smoothClosed([
          [-112, 60],
          [-128, -40],
          [1, -40],
          [128, -40],
          [112, 60],
          [1, 76],
        ]),
        fill: { slot: 'coverShade' },
        behind: true,
      },
      { d: outer + opening, fill: { slot: 'cover' }, evenOdd: true },
      // Folded edge framing the face.
      {
        d: ellipse(FACE.cx, -84, 90, 96) + ellipse(FACE.cx, -84, 84, 90),
        fill: { slot: 'coverShade' },
        evenOdd: true,
      },
      {
        d:
          smoothOpen([
            [-90, 14],
            [-50, 34],
            [-8, 40],
          ]) +
          smoothOpen([
            [96, -10],
            [70, 26],
            [40, 44],
          ]),
        stroke: { slot: 'coverShade', width: 3 },
      },
      {
        d: smoothOpen([
          [-62, -196],
          [-20, -214],
        ]),
        stroke: { slot: 'coverHighlight', width: 6, alpha: 0.9 },
      },
    ],
  };
}

function dastar(): ShapeSet {
  const body = smoothClosed([
    [-104, -124],
    [-112, -176],
    [-90, -228],
    [-40, -252],
    [1, -256],
    [42, -252],
    [92, -228],
    [114, -176],
    [106, -124],
    [60, -138],
    [1, -146],
    [-60, -138],
  ]);
  return {
    layers: [
      { d: ellipse(1, -180, 110, 70), fill: { slot: 'coverShade' }, behind: true },
      { d: body, fill: { slot: 'cover' } },
      // Layered wraps meeting in a peak at the front.
      {
        d:
          smoothOpen([
            [-104, -150],
            [-50, -170],
            [1, -196],
          ]) +
          smoothOpen([
            [106, -150],
            [50, -170],
            [1, -196],
          ]) +
          smoothOpen([
            [-108, -182],
            [-56, -204],
            [1, -230],
          ]) +
          smoothOpen([
            [110, -182],
            [56, -204],
            [1, -230],
          ]) +
          smoothOpen([
            [-88, -226],
            [-40, -240],
            [1, -252],
          ]),
        stroke: { slot: 'coverShade', width: 3.2 },
      },
      {
        d: smoothOpen([
          [-70, -222],
          [-36, -238],
        ]),
        stroke: { slot: 'coverHighlight', width: 6, alpha: 0.85 },
      },
    ],
  };
}

function headwrap(): ShapeSet {
  const wrap = smoothClosed([
    [-102, -128],
    [-112, -180],
    [-96, -226],
    [-52, -250],
    [1, -256],
    [54, -250],
    [98, -226],
    [112, -180],
    [104, -128],
    [56, -142],
    [1, -148],
    [-56, -142],
  ]);
  const knot = smoothClosed([
    [-8, -236],
    [-62, -270],
    [-58, -300],
    [-14, -284],
    [1, -262],
    [16, -284],
    [60, -302],
    [66, -270],
    [10, -236],
  ]);
  return {
    layers: [
      { d: ellipse(1, -184, 110, 72), fill: { slot: 'coverShade' }, behind: true },
      { d: knot, fill: { slot: 'coverShade' }, spring: 'knot' },
      { d: wrap, fill: { slot: 'cover' } },
      {
        d:
          smoothOpen([
            [-104, -152],
            [-40, -176],
            [40, -200],
            [100, -214],
          ]) +
          smoothOpen([
            [-96, -206],
            [-30, -224],
            [40, -238],
          ]),
        stroke: { slot: 'coverShade', width: 3.2 },
      },
      { d: ellipse(1, -244, 13, 11), fill: { slot: 'cover' } },
      {
        d: smoothOpen([
          [-72, -224],
          [-40, -240],
        ]),
        stroke: { slot: 'coverHighlight', width: 6, alpha: 0.85 },
      },
    ],
    springs: {
      knot: { pivot: [1, -244], stiffness: 90, damping: 7, inertia: 0.002, maxAngle: 4, hang: 0.2 },
    },
  };
}

export function coveringShapes(kind: HeadCovering): ShapeSet {
  if (kind === 'hijab') return hijab();
  if (kind === 'dastar') return dastar();
  if (kind === 'headwrap') return headwrap();
  return { layers: [] };
}

export const coveringLabels: Readonly<Record<HeadCovering, string>> = {
  none: 'None',
  hijab: 'Hijab',
  dastar: 'Dastar (turban)',
  headwrap: 'Headwrap',
};

/** The face outline, for tests that check face features stay on the face. */
export const FACE_OUTLINE = FACE;
export const MOUTH_POINT = MOUTH;
