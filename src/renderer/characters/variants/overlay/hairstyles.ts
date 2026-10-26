// Hairstyle shape sets in head space (origin at the head node; the face outline is centred at
// (1, -92) with radii 95 x 93, brows at y -125, eyes -94, ears at x +-105, y -80).
// Built-in hair is hidden when one of these is chosen. Back masses sit on the canvas behind the
// character and follow `hair squash`; side locks follow the remix's own side bones
// (`hair left swing` / `hair right swing`), so the existing hair physics moves them; springs add
// secondary motion. Drawing guidance: docs/character/VARIANTS-RESEARCH.md section 3.
import type { HairStyle } from '../../../../../shared/variants';
import type { Spring } from '../../../attachments/schema';
import {
  P,
  blob,
  cloud,
  coil,
  ellipse,
  marks,
  quad,
  rng,
  smoothClosed,
  smoothOpen,
  spiral,
  tube,
  type Pt,
} from './geometry';
import type { OverlayLayer, ShapeSet } from './types';

const SKULL = { cx: 1, cy: -95, rx: 101, ry: 103 };
const HAIRLINE_Y = -150;

const spring = (pivot: Pt, over: Partial<Spring> = {}): Spring => ({
  pivot: [pivot[0], pivot[1]],
  stiffness: 60,
  damping: 6,
  inertia: 0.004,
  maxAngle: 14,
  hang: 0.5,
  ...over,
});

/** x on the skull ellipse at height y (right side). */
function skullX(y: number, grow = 0) {
  const dy = (y - SKULL.cy) / (SKULL.ry + grow);
  return (SKULL.rx + grow) * Math.sqrt(Math.max(0, 1 - dy * dy));
}

/**
 * The hair cap seen from the front: the skull above a hairline. `line` lists hairline points
 * from the right temple to the left temple (x descending); `grow` puffs the cap outward.
 */
function cap(line: readonly Pt[], grow = 3) {
  const first = line[0] as Pt,
    last = line[line.length - 1] as Pt;
  const rx = SKULL.rx + grow,
    ry = SKULL.ry + grow;
  const left: Pt = [SKULL.cx - skullX(last[1], grow), last[1]];
  const right: Pt = [SKULL.cx + skullX(first[1], grow), first[1]];
  return (
    `M${P(left)}A${String(rx)} ${String(ry)} 0 0 1 ${P(right)}` +
    smoothOpen([right, ...line, left]).replace(/^M[^C]*/, '') +
    'Z'
  );
}

/** A soft hairline: temples at y -128, centre at `y`, optional widow's peak. */
function hairline(y = HAIRLINE_Y, peak = 0): Pt[] {
  return [
    [93, -126],
    [70, y + 6],
    [30, y + 1],
    [0, y + peak],
    [-30, y + 1],
    [-70, y + 6],
    [-91, -126],
  ];
}

/** Hairline made of small coil bumps (afro, puffs, TWA). */
function coilyHairline(y = HAIRLINE_Y, seed = 3): Pt[] {
  const random = rng(seed);
  const out: Pt[] = [];
  for (let i = 0; i <= 12; i++) {
    const x = 93 - (186 * i) / 12;
    const base = -126 + (y + 2 - -126) * Math.sin((Math.PI * i) / 12);
    out.push([x, base + (i % 2 ? 4 + random() * 2 : -1)]);
  }
  return out;
}

/** Shade crescent on the lower right of a mass, and a highlight on the upper left. */
function volumeShading(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  behind: boolean,
  follow: OverlayLayer['follow'],
) {
  return [
    {
      d: blob(cx - rx * 0.38, cy - ry * 0.55, rx * 0.22, ry * 0.12, 11, 6),
      fill: { slot: 'hairHighlight', alpha: 0.85 },
      behind,
      follow,
    },
  ] satisfies OverlayLayer[];
}

function textureCoils(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  count: number,
  seed: number,
  behind: boolean,
  minR = 0.62,
): OverlayLayer {
  const random = rng(seed);
  let d = '';
  for (let i = 0; i < count; i++) {
    const a = random() * Math.PI * 2;
    const k = minR + random() * (0.93 - minR);
    const x = cx + Math.cos(a) * rx * k,
      y = cy + Math.sin(a) * ry * k;
    d += coil(x, y, 3.2 + random() * 2, random() > 0.5 ? 1 : -1);
  }
  return { d, stroke: { slot: 'hairDeep', width: 2.4, alpha: 0.8 }, behind, follow: 'hairBack' };
}

// --- styles -------------------------------------------------------------------------------

function afro(): ShapeSet {
  const c = { x: 1, y: -132, rx: 152, ry: 128 };
  return {
    layers: [
      {
        d: cloud(c.x + 4, c.y + 6, c.rx, c.ry, { bumps: 24, seed: 7 }),
        fill: { slot: 'hairShade' },
        behind: true,
        follow: 'hairBack',
        spring: 'mass',
      },
      {
        d: cloud(c.x - 3, c.y - 3, c.rx - 9, c.ry - 9, { bumps: 22, seed: 8 }),
        fill: { slot: 'hair' },
        behind: true,
        follow: 'hairBack',
        spring: 'mass',
      },
      { ...textureCoils(c.x, c.y, c.rx, c.ry, 34, 21, true), spring: 'mass' },
      ...volumeShading(c.x, c.y, c.rx, c.ry, true, 'hairBack').map((l) => ({
        ...l,
        spring: 'mass',
      })),
      { d: cap(coilyHairline(-148, 4), 8), fill: { slot: 'hair' } },
      {
        d: textureCoils(1, -175, 80, 22, 10, 31, false, 0.1).d,
        stroke: { slot: 'hairDeep', width: 2.2, alpha: 0.75 },
      },
    ],
    springs: {
      mass: spring([1, -60], { stiffness: 150, damping: 11, maxAngle: 2.5, inertia: 0.002 }),
    },
  };
}

function puffs(): ShapeSet {
  const layers: OverlayLayer[] = [];
  const springs: Record<string, Spring> = {};
  for (const side of [-1, 1] as const) {
    const id = side < 0 ? 'puffL' : 'puffR';
    const cx = 80 * side + 1,
      cy = -226;
    springs[id] = spring([62 * side, -192], { stiffness: 70, damping: 5, maxAngle: 7, hang: 0.25 });
    layers.push(
      {
        d: cloud(cx + 3, cy + 4, 56, 50, { bumps: 13, seed: 40 + side }),
        fill: { slot: 'hairShade' },
        behind: true,
        spring: id,
      },
      {
        d: cloud(cx - 2, cy - 2, 50, 45, { bumps: 12, seed: 50 + side }),
        fill: { slot: 'hair' },
        behind: true,
        spring: id,
      },
      { ...textureCoils(cx, cy, 52, 46, 9, 60 + side, true), follow: undefined, spring: id },
      {
        d: blob(cx - 18, cy - 20, 11, 7, 70 + side, 6),
        fill: { slot: 'hairHighlight', alpha: 0.85 },
        behind: true,
        spring: id,
      },
    );
  }
  layers.push(
    { d: cap(coilyHairline(-150, 9), 2), fill: { slot: 'hair' } },
    // Hair pulled up toward the bands: smooth, with direction lines.
    {
      d:
        smoothOpen([
          [-40, -160],
          [-50, -182],
          [-60, -194],
        ]) +
        smoothOpen([
          [40, -160],
          [50, -182],
          [61, -194],
        ]) +
        smoothOpen([
          [-8, -158],
          [-30, -190],
        ]) +
        smoothOpen([
          [10, -158],
          [32, -190],
        ]),
      stroke: { slot: 'hairShade', width: 2.4 },
    },
    {
      d: smoothOpen([
        [-10, -196],
        [1, -204],
        [12, -196],
      ]),
      stroke: { slot: 'scalp', width: 2.2, alpha: 0.8 },
    },
  );
  for (const side of [-1, 1] as const)
    layers.push({
      d: smoothClosed([
        [50 * side, -186],
        [64 * side, -200],
        [76 * side, -190],
        [62 * side, -178],
      ]),
      fill: { slot: 'hairDeep' },
    });
  return { layers, springs };
}

function bantuKnots(): ShapeSet {
  const knots: [number, number, number][] = [
    [-74, -196, 23],
    [-26, -226, 25],
    [28, -226, 25],
    [76, -196, 23],
    [1, -178, 19],
  ];
  const layers: OverlayLayer[] = [
    {
      d: ellipse(SKULL.cx, SKULL.cy - 2, SKULL.rx + 4, SKULL.ry + 4),
      fill: { slot: 'hairShade' },
      behind: true,
      follow: 'hairBack',
    },
    { d: cap(hairline(-151), 3), fill: { slot: 'hair' } },
    // Scalp parts between the sections.
    {
      d:
        smoothOpen([
          [1, -151],
          [1, -200],
        ]) +
        smoothOpen([
          [-50, -146],
          [-48, -194],
        ]) +
        smoothOpen([
          [52, -146],
          [50, -194],
        ]) +
        smoothOpen([
          [-92, -168],
          [-10, -196],
          [92, -168],
        ]),
      stroke: { slot: 'scalp', width: 2.6, alpha: 0.9 },
    },
  ];
  for (const [x, y, r] of knots)
    layers.push(
      { d: ellipse(x + 2, y + 3, r, r * 0.92), fill: { slot: 'hairShade' } },
      { d: ellipse(x, y, r - 2, r * 0.9 - 2), fill: { slot: 'hair' } },
      { d: spiral(x, y, r - 5), stroke: { slot: 'hairDeep', width: 2.6, alpha: 0.9 } },
      {
        d: blob(x - r * 0.35, y - r * 0.4, r * 0.25, r * 0.15, Math.round(x), 5),
        fill: { slot: 'hairHighlight', alpha: 0.85 },
      },
    );
  return { layers };
}

interface StrandOptions {
  width: number;
  vary: number;
  kind: 'band' | 'chevron' | 'twist';
  every: number;
  tip: 'round' | 'banded';
  seed: number;
}

/** One loc / braid / twist along a curve, with its texture marks. */
function strand(
  a: Pt,
  c: Pt,
  b: Pt,
  o: StrandOptions,
  base: Partial<OverlayLayer>,
): OverlayLayer[] {
  const random = rng(o.seed);
  const line = quad(a, c, b, 14);
  const w0 = o.width * (1 - o.vary / 2 + random() * o.vary);
  const width = (t: number) =>
    w0 * (o.tip === 'banded' ? 1 - 0.25 * t : 1 - 0.08 * t + 0.05 * Math.sin(t * 9 + o.seed));
  const out: OverlayLayer[] = [
    { ...base, d: tube(line, width), fill: { slot: 'hair' } },
    {
      ...base,
      d: tube(
        line.map(([x, y]) => [x - w0 * 0.22, y] as Pt),
        (t) => width(t) * 0.28,
      ),
      fill: { slot: 'hairHighlight', alpha: 0.55 },
    },
    {
      ...base,
      d: marks(line, width, {
        every: o.every,
        kind: o.kind,
        from: 0.06,
        to: o.tip === 'banded' ? 0.86 : 0.94,
      }),
      stroke: { slot: 'hairDeep', width: o.kind === 'band' ? 2.2 : 1.7, alpha: 0.85 },
    },
  ];
  if (o.tip === 'banded') {
    const end = line[line.length - 2] as Pt;
    out.push({
      ...base,
      d: ellipse(end[0], end[1], w0 * 0.42, w0 * 0.3),
      fill: { slot: 'hairDeep' },
    });
  }
  return out;
}

/** Long strand styles (locs, box braids): crown, back curtain, two front bundles on the side bones. */
function strands(kind: 'locs' | 'braids'): ShapeSet {
  const locs = kind === 'locs';
  const o: Omit<StrandOptions, 'seed'> = locs
    ? { width: 17, vary: 0.3, kind: 'band', every: 0.13, tip: 'round' }
    : { width: 11, vary: 0.12, kind: 'chevron', every: 0.075, tip: 'banded' };
  const length = locs ? 52 : 96;
  const layers: OverlayLayer[] = [];
  // Back curtain: strands hanging behind the head and shoulders.
  const back = locs ? 9 : 13;
  for (let i = 0; i < back; i++) {
    const t = i / (back - 1);
    const x = -112 + 224 * t;
    const top: Pt = [x * 0.75, -150 + Math.abs(x) * 0.25];
    const end: Pt = [x * 1.08, length - 8 + Math.cos(t * Math.PI * 2) * 6];
    layers.push(
      ...strand(
        top,
        [x * 1.12, (top[1] + end[1]) / 2],
        end,
        { ...o, seed: 100 + i },
        { behind: true, follow: 'hairBack', spring: 'back' },
      ).map((l) => (l.fill?.slot === 'hair' ? { ...l, fill: { slot: 'hairShade' as const } } : l)),
    );
  }
  // Crown volume behind the head.
  layers.unshift({
    d: ellipse(SKULL.cx, SKULL.cy - 6, SKULL.rx + 10, SKULL.ry + 8),
    fill: { slot: 'hairShade' },
    behind: true,
    follow: 'hairBack',
  });
  // Scalp/root cap, then individual strands rooted at the hairline running back over the crown
  // (the hair "comes from somewhere": parts show between roots, VARIANTS-RESEARCH.md section 3).
  layers.push({ d: cap(hairline(-147, -2), 4), fill: { slot: locs ? 'hairShade' : 'scalp' } });
  if (!locs)
    layers.push({
      d: smoothOpen([
        [-90, -168],
        [-44, -186],
        [1, -191],
        [46, -186],
        [92, -168],
      ]),
      stroke: { slot: 'hairShade', width: 1.6, alpha: 0.6 },
    });
  const columns = locs ? 8 : 11;
  const crownWidth = locs ? 16 : 11;
  for (let i = 0; i < columns; i++) {
    const x = -88 + (176 * i) / (columns - 1);
    const rootY = -146 + Math.abs(x) * 0.2 + (Math.abs(x) > 75 ? 6 : 0);
    layers.push(
      ...strand(
        [x, rootY],
        [x * 0.9, -186],
        [x * 0.42, -207 + Math.abs(x) * 0.08],
        {
          ...o,
          width: crownWidth,
          tip: 'round',
          every: locs ? 0.26 : 0.14,
          seed: 300 + i,
        },
        {},
      ),
    );
  }
  // Front bundles framing the face, on the remix's side bones.
  const front = locs ? 3 : 4;
  for (const side of [-1, 1] as const) {
    const follow = side < 0 ? 'hairLeft' : 'hairRight';
    for (let i = 0; i < front; i++) {
      const x = side * (82 + i * (locs ? 13 : 8.5));
      const top: Pt = [x - side * 6, -156 + i * 6];
      const end: Pt = [x + side * (10 + i * 3), (locs ? 34 : 70) + i * (locs ? 5 : 4)];
      layers.push(
        ...strand(
          top,
          [x + side * 14, -60],
          end,
          { ...o, seed: 200 + i + side * 10 },
          { follow, spring: side < 0 ? 'frontL' : 'frontR' },
        ),
      );
    }
  }
  const heavy = { stiffness: locs ? 34 : 30, damping: 4.5, maxAngle: 7, inertia: 0.003, hang: 0.4 };
  return {
    layers,
    springs: {
      back: spring([1, -150], heavy),
      frontL: spring([-86, -150], heavy),
      frontR: spring([86, -150], heavy),
    },
  };
}

function cornrows(): ShapeSet {
  const layers: OverlayLayer[] = [
    {
      d: ellipse(SKULL.cx, SKULL.cy - 1, SKULL.rx + 3, SKULL.ry + 2),
      fill: { slot: 'hairShade' },
      behind: true,
      follow: 'hairBack',
    },
    { d: cap(hairline(-152), 2), fill: { slot: 'scalp' } },
  ];
  const rows = 6;
  for (let i = 0; i < rows; i++) {
    const x = -80 + (160 * i) / (rows - 1);
    const line = quad(
      [x, -148 - Math.abs(x) * 0.12 + (Math.abs(x) > 70 ? 14 : 0)],
      [x * 0.95, -182],
      [x * 0.55, -204 + Math.abs(x) * 0.12],
      10,
    );
    const width = () => 22;
    layers.push(
      { d: tube(line, width), fill: { slot: 'hair' } },
      {
        d: marks(line, width, { every: 0.12, kind: 'chevron', from: 0.02, to: 0.9 }),
        stroke: { slot: 'hairDeep', width: 2, alpha: 0.85 },
      },
    );
  }
  return { layers };
}

function waves(): ShapeSet {
  let arcs = '';
  // Concentric waves around the crown, kept inside the cap (lowest point -214 + 0.8 r).
  for (let r = 30; r <= 74; r += 11)
    arcs += `M${P([1 - r * 0.72, -214 + r * 0.55])}Q${P([1, -214 + r * 1.05])} ${P([1 + r * 0.72, -214 + r * 0.55])}`;
  return {
    layers: [
      {
        d: ellipse(SKULL.cx, SKULL.cy - 1, SKULL.rx + 4, SKULL.ry + 3),
        fill: { slot: 'hairShade' },
        behind: true,
        follow: 'hairBack',
      },
      {
        d: cap(
          [
            [96, -104],
            [90, -124],
            [70, -146],
            [30, -151],
            [0, -152],
            [-30, -151],
            [-70, -146],
            [-88, -124],
            [-94, -104],
          ],
          4,
        ),
        fill: { slot: 'hair' },
      },
      { d: arcs, stroke: { slot: 'hairShade', width: 2.6, alpha: 0.9 } },
      // Tapered edge at the temples.
      {
        d:
          smoothOpen([
            [94, -104],
            [90, -124],
            [72, -145],
          ]) +
          smoothOpen([
            [-92, -104],
            [-88, -124],
            [-70, -145],
          ]),
        stroke: { slot: 'skin', width: 3, alpha: 0.35 },
      },
    ],
  };
}

function bob(): ShapeSet {
  const back = smoothClosed([
    [-122, -12],
    [-128, -90],
    [-110, -178],
    [-60, -214],
    [1, -224],
    [62, -214],
    [112, -178],
    [130, -90],
    [124, -12],
    [80, -4],
    [-80, -4],
  ]);
  return {
    layers: [
      { d: back, fill: { slot: 'hairShade' }, behind: true, follow: 'hairBack', spring: 'back' },
      { d: cap(hairline(-148), 9), fill: { slot: 'hair' } },
      // Blunt fringe.
      {
        d: cap(
          [
            [95, -132],
            [72, -143],
            [30, -141],
            [0, -143],
            [-30, -141],
            [-72, -143],
            [-93, -132],
          ],
          9,
        ),
        fill: { slot: 'hair' },
      },
      {
        d: smoothOpen([
          [-62, -190],
          [-24, -202],
          [14, -200],
        ]),
        stroke: { slot: 'hairHighlight', width: 6, alpha: 0.8 },
      },
      // Side curtains framing the face (on the side bones).
      ...([-1, 1] as const).flatMap((side): OverlayLayer[] => [
        {
          d: smoothClosed([
            [side * 86, -150],
            [side * 112, -150],
            [side * 126, -80],
            [side * 124, -14],
            [side * 100, -8],
            [side * 92, -24],
            [side * 96, -80],
          ]),
          fill: { slot: 'hair' },
          follow: side < 0 ? 'hairLeft' : 'hairRight',
          spring: side < 0 ? 'left' : 'right',
        },
        {
          d: smoothOpen([
            [side * 104, -120],
            [side * 112, -60],
            [side * 108, -22],
          ]),
          stroke: { slot: 'hairShade', width: 3, alpha: 0.9 },
          follow: side < 0 ? 'hairLeft' : 'hairRight',
          spring: side < 0 ? 'left' : 'right',
        },
      ]),
    ],
    springs: {
      back: spring([1, -150], { stiffness: 60, maxAngle: 4 }),
      left: spring([-100, -150], { stiffness: 55, maxAngle: 9 }),
      right: spring([100, -150], { stiffness: 55, maxAngle: 9 }),
    },
  };
}

function pixie(): ShapeSet {
  return {
    layers: [
      {
        d: ellipse(SKULL.cx + 2, SKULL.cy - 6, SKULL.rx + 8, SKULL.ry + 6),
        fill: { slot: 'hairShade' },
        behind: true,
        follow: 'hairBack',
      },
      {
        d: cap(
          [
            [98, -108],
            [94, -126],
            [72, -150],
            [30, -156],
            [0, -158],
            [-40, -152],
            [-80, -138],
            [-96, -110],
          ],
          8,
        ),
        fill: { slot: 'hair' },
      },
      // Swept fringe tufts.
      {
        d: smoothClosed([
          [-70, -170],
          [-30, -186],
          [30, -184],
          [62, -164],
          [40, -150],
          [26, -136],
          [10, -148],
          [-10, -140],
          [-26, -150],
          [-46, -146],
          [-60, -156],
        ]),
        fill: { slot: 'hair' },
        spring: 'fringe',
      },
      {
        d: smoothOpen([
          [-40, -176],
          [0, -168],
          [32, -156],
        ]),
        stroke: { slot: 'hairShade', width: 2.6 },
        spring: 'fringe',
      },
      // Tufts at the temples, in front of the ear tops.
      ...([-1, 1] as const).map((side): OverlayLayer => ({
        d: smoothClosed([
          [side * 88, -140],
          [side * 104, -128],
          [side * 100, -100],
          [side * 92, -108],
        ]),
        fill: { slot: 'hair' },
      })),
      {
        d: smoothOpen([
          [-52, -184],
          [-16, -194],
        ]),
        stroke: { slot: 'hairHighlight', width: 5, alpha: 0.8 },
      },
    ],
    springs: { fringe: spring([1, -180], { stiffness: 90, maxAngle: 5 }) },
  };
}

function long(): ShapeSet {
  const back = smoothClosed([
    [-124, 112],
    [-136, 20],
    [-128, -100],
    [-108, -182],
    [-56, -216],
    [1, -224],
    [58, -216],
    [110, -182],
    [130, -100],
    [138, 20],
    [126, 112],
    [100, 124],
    [70, 116],
    [40, 124],
    [-40, 124],
    [-70, 116],
    [-100, 124],
  ]);
  return {
    layers: [
      { d: back, fill: { slot: 'hairShade' }, behind: true, follow: 'hairBack', spring: 'back' },
      { d: cap(hairline(-150, -2), 8), fill: { slot: 'hair' } },
      {
        d: smoothOpen([
          [1, -152],
          [-2, -180],
          [1, -201],
        ]),
        stroke: { slot: 'scalp', width: 2.4, alpha: 0.85 },
      },
      {
        d:
          smoothOpen([
            [-66, -178],
            [-34, -190],
          ]) +
          smoothOpen([
            [34, -190],
            [66, -178],
          ]),
        stroke: { slot: 'hairHighlight', width: 6, alpha: 0.8 },
      },
      ...([-1, 1] as const).flatMap((side): OverlayLayer[] => {
        const follow = side < 0 ? 'hairLeft' : 'hairRight';
        const s = side < 0 ? 'left' : 'right';
        return [
          {
            d: smoothClosed([
              [side * 70, -152],
              [side * 104, -150],
              [side * 126, -60],
              [side * 132, 30],
              [side * 124, 84],
              [side * 110, 92],
              [side * 104, 40],
              [side * 96, -60],
              [side * 86, -120],
            ]),
            fill: { slot: 'hair' },
            follow,
            spring: s,
          },
          {
            d: smoothOpen([
              [side * 112, -110],
              [side * 120, -20],
              [side * 118, 60],
            ]),
            stroke: { slot: 'hairHighlight', width: 4, alpha: 0.6 },
            follow,
            spring: s,
          },
          {
            d: smoothOpen([
              [side * 100, -90],
              [side * 108, 10],
              [side * 116, 70],
            ]),
            stroke: { slot: 'hairShade', width: 2.4 },
            follow,
            spring: s,
          },
        ];
      }),
    ],
    springs: {
      back: spring([1, -150], { stiffness: 40, maxAngle: 5, hang: 0.6 }),
      left: spring([-92, -150], { stiffness: 38, maxAngle: 8 }),
      right: spring([92, -150], { stiffness: 38, maxAngle: 8 }),
    },
  };
}

/** Smooth cap with lines pulled toward a point (buns, ponytails). */
function pulled(toward: Pt): OverlayLayer[] {
  const lines = [-70, -40, -12, 16, 44, 72]
    .map((x) =>
      smoothOpen([
        [x, -150 - Math.abs(x) * 0.05],
        [x * 0.6 + toward[0] * 0.4, -175],
        [toward[0] + x * 0.12, toward[1] + 10],
      ]),
    )
    .join('');
  return [
    { d: cap(hairline(-150), 4), fill: { slot: 'hair' } },
    { d: lines, stroke: { slot: 'hairShade', width: 2.2, alpha: 0.9 } },
  ];
}

function topBun(): ShapeSet {
  const bun: Pt = [1, -236];
  return {
    layers: [
      {
        d: ellipse(SKULL.cx, SKULL.cy - 3, SKULL.rx + 5, SKULL.ry + 4),
        fill: { slot: 'hairShade' },
        behind: true,
        follow: 'hairBack',
      },
      {
        d: ellipse(bun[0] + 3, bun[1] + 3, 44, 38),
        fill: { slot: 'hairShade' },
        behind: true,
        spring: 'bun',
      },
      { d: ellipse(bun[0], bun[1], 41, 35), fill: { slot: 'hair' }, behind: true, spring: 'bun' },
      {
        d: spiral(bun[0], bun[1] + 2, 30, 1.3),
        stroke: { slot: 'hairDeep', width: 2.6, alpha: 0.85 },
        behind: true,
        spring: 'bun',
      },
      {
        d: blob(bun[0] - 16, bun[1] - 16, 10, 6, 5, 5),
        fill: { slot: 'hairHighlight', alpha: 0.85 },
        behind: true,
        spring: 'bun',
      },
      ...pulled([1, -205]),
      {
        d: smoothClosed([
          [-22, -204],
          [1, -210],
          [24, -204],
          [1, -196],
        ]),
        fill: { slot: 'hairDeep' },
      },
    ],
    springs: { bun: spring([1, -200], { stiffness: 85, maxAngle: 5, hang: 0.2 }) },
  };
}

function ponytail(): ShapeSet {
  const line = quad([44, -200], [150, -190], [138, -30], 16);
  const width = (t: number) => 46 - 26 * t + 8 * Math.sin(t * Math.PI);
  return {
    layers: [
      {
        d: ellipse(SKULL.cx, SKULL.cy - 3, SKULL.rx + 5, SKULL.ry + 4),
        fill: { slot: 'hairShade' },
        behind: true,
        follow: 'hairBack',
      },
      { d: tube(line, width), fill: { slot: 'hairShade' }, behind: true, spring: 'tail' },
      {
        d: tube(
          line.map(([x, y]) => [x - 3, y - 2] as Pt),
          (t) => width(t) * 0.84,
        ),
        fill: { slot: 'hair' },
        behind: true,
        spring: 'tail',
      },
      {
        d: smoothOpen([
          [70, -200],
          [128, -170],
          [132, -80],
        ]),
        stroke: { slot: 'hairHighlight', width: 4, alpha: 0.7 },
        behind: true,
        spring: 'tail',
      },
      ...pulled([46, -198]),
      {
        d: smoothClosed([
          [34, -210],
          [52, -214],
          [58, -196],
          [40, -190],
        ]),
        fill: { slot: 'hairDeep' },
      },
    ],
    springs: {
      tail: spring([46, -200], { stiffness: 40, damping: 3.6, maxAngle: 16, hang: 0.55 }),
    },
  };
}

function shaved(): ShapeSet {
  return {
    layers: [
      { d: cap(hairline(-152), 1), fill: { slot: 'hair', alpha: 0.32 } },
      {
        d: smoothOpen([
          [-48, -186],
          [-14, -196],
        ]),
        stroke: { slot: 'white', width: 5, alpha: 0.28 },
      },
    ],
  };
}

const builders: Readonly<Record<Exclude<HairStyle, 'curls'>, () => ShapeSet>> = {
  locs: () => strands('locs'),
  afro,
  'box-braids': () => strands('braids'),
  puffs,
  bob,
  pixie,
  long,
  'top-bun': topBun,
  'bantu-knots': bantuKnots,
  cornrows,
  waves,
  ponytail,
  shaved,
};

const cache = new Map<HairStyle, ShapeSet>();
/** Shape set for a hairstyle; `curls` is the character's own hair and has no overlay. */
export function hairstyleShapes(style: HairStyle): ShapeSet {
  if (style === 'curls') return { layers: [] };
  let found = cache.get(style);
  if (!found) cache.set(style, (found = builders[style]()));
  return found;
}

export const hairStyleLabels: Readonly<Record<HairStyle, string>> = {
  locs: 'Locs',
  afro: 'Coily afro',
  'box-braids': 'Box braids',
  puffs: 'Puffs',
  bob: 'Bob',
  pixie: 'Pixie',
  long: 'Long straight',
  'top-bun': 'Top bun',
  'bantu-knots': 'Bantu knots',
  cornrows: 'Cornrows',
  waves: 'Waves',
  ponytail: 'Ponytail',
  curls: 'Curls (original)',
  shaved: 'Shaved',
};
