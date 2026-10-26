// Path builders for hair and feature shape sets: rounded, flat shapes in the mascot's style.
// Everything returns SVG path data in head space (artboard units, origin at the head node,
// y down). Deterministic: irregularity comes from a seeded generator, never Math.random.
export type Pt = readonly [number, number];

const f = (n: number) => (Math.round(n * 10) / 10).toString();
export const P = (p: Pt) => `${f(p[0])} ${f(p[1])}`;

/** Small deterministic PRNG (mulberry32). */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function ellipse(cx: number, cy: number, rx: number, ry = rx) {
  return `M${P([cx - rx, cy])}A${f(rx)} ${f(ry)} 0 1 0 ${P([cx + rx, cy])}A${f(rx)} ${f(ry)} 0 1 0 ${P([cx - rx, cy])}Z`;
}

/** Smooth closed curve through points (Catmull-Rom converted to cubic Béziers). */
export function smoothClosed(points: readonly Pt[], tension = 1) {
  const n = points.length;
  const at = (i: number) => points[((i % n) + n) % n] as Pt;
  let d = `M${P(at(0))}`;
  for (let i = 0; i < n; i++) {
    const p0 = at(i - 1),
      p1 = at(i),
      p2 = at(i + 1),
      p3 = at(i + 2);
    const c1: Pt = [
      p1[0] + ((p2[0] - p0[0]) / 6) * tension,
      p1[1] + ((p2[1] - p0[1]) / 6) * tension,
    ];
    const c2: Pt = [
      p2[0] - ((p3[0] - p1[0]) / 6) * tension,
      p2[1] - ((p3[1] - p1[1]) / 6) * tension,
    ];
    d += `C${P(c1)} ${P(c2)} ${P(p2)}`;
  }
  return d + 'Z';
}

/** Smooth open curve through points. */
export function smoothOpen(points: readonly Pt[]) {
  const n = points.length;
  const at = (i: number) => points[Math.max(0, Math.min(n - 1, i))] as Pt;
  let d = `M${P(at(0))}`;
  for (let i = 0; i < n - 1; i++) {
    const p0 = at(i - 1),
      p1 = at(i),
      p2 = at(i + 1),
      p3 = at(i + 2);
    const c1: Pt = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2: Pt = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${P(c1)} ${P(c2)} ${P(p2)}`;
  }
  return d;
}

/**
 * Cloud outline for coily hair: an irregular ellipse whose edge is a chain of outward bumps,
 * fuller where `weight` says (never a perfect circle, VARIANTS-RESEARCH.md section 3).
 */
export function cloud(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  { bumps = 18, depth = 0.09, seed = 1, start = 0, end = Math.PI * 2, close = true } = {},
) {
  const random = rng(seed);
  const span = end - start;
  const count = Math.max(2, Math.round((bumps * span) / (Math.PI * 2)));
  const pts: Pt[] = [];
  for (let i = 0; i <= count; i++) {
    const a = start + (span * i) / count;
    const jitter = 1 + (random() - 0.5) * 0.05;
    pts.push([cx + Math.cos(a) * rx * jitter, cy + Math.sin(a) * ry * jitter]);
  }
  let d = `M${P(pts[0] as Pt)}`;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1] as Pt,
      b = pts[i] as Pt;
    const mid: Pt = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const nx = mid[0] - cx,
      ny = mid[1] - cy;
    const len = Math.hypot(nx / rx, ny / ry) || 1;
    const bulge = (depth * (0.75 + random() * 0.5)) / len;
    const ctrl: Pt = [mid[0] + nx * bulge * 1.9, mid[1] + ny * bulge * 1.9];
    d += `Q${P(ctrl)} ${P(b)}`;
  }
  return close ? d + 'Z' : d;
}

/** Points along a quadratic curve. */
export function quad(a: Pt, c: Pt, b: Pt, steps: number): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps,
      u = 1 - t;
    out.push([
      u * u * a[0] + 2 * u * t * c[0] + t * t * b[0],
      u * u * a[1] + 2 * u * t * c[1] + t * t * b[1],
    ]);
  }
  return out;
}

/**
 * A rounded tube along a centreline (locs, braids, twists, ponytail): width per point, round
 * ends. Returns the outline path.
 */
export function tube(line: readonly Pt[], width: (t: number) => number) {
  const n = line.length;
  const left: Pt[] = [],
    right: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const p = line[i] as Pt;
    const a = line[Math.max(0, i - 1)] as Pt,
      b = line[Math.min(n - 1, i + 1)] as Pt;
    const tx = b[0] - a[0],
      ty = b[1] - a[1];
    const len = Math.hypot(tx, ty) || 1;
    const w = width(i / (n - 1)) / 2;
    left.push([p[0] - (ty / len) * w, p[1] + (tx / len) * w]);
    right.push([p[0] + (ty / len) * w, p[1] - (tx / len) * w]);
  }
  const wEnd = width(1) / 2,
    wStart = width(0) / 2;
  let d = `M${P(left[0] as Pt)}`;
  for (let i = 1; i < n; i++) d += `L${P(left[i] as Pt)}`;
  d += `A${f(wEnd)} ${f(wEnd)} 0 0 0 ${P(right[n - 1] as Pt)}`;
  for (let i = n - 2; i >= 0; i--) d += `L${P(right[i] as Pt)}`;
  d += `A${f(wStart)} ${f(wStart)} 0 0 0 ${P(left[0] as Pt)}Z`;
  return d;
}

/** Normal-offset point on a centreline at parameter t (0..1), `side` in units (+ right). */
export function along(line: readonly Pt[], t: number, side = 0): Pt {
  const n = line.length - 1;
  const i = Math.min(n - 1, Math.floor(t * n));
  const a = line[i] as Pt,
    b = line[i + 1] as Pt;
  const k = t * n - i;
  const p: Pt = [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  return [p[0] + ((b[1] - a[1]) / len) * side, p[1] - ((b[0] - a[0]) / len) * side];
}

/** Short marks across a tube (loc segments, twist ticks, braid chevrons) as one stroke path. */
export function marks(
  line: readonly Pt[],
  width: (t: number) => number,
  {
    every = 0.12,
    from = 0.08,
    to = 0.95,
    kind = 'band',
  }: { every?: number; from?: number; to?: number; kind?: 'band' | 'chevron' | 'twist' } = {},
) {
  let d = '';
  for (let t = from; t <= to; t += every) {
    const w = width(t) * 0.42;
    if (kind === 'chevron') {
      const tip = along(line, t + every * 0.35);
      d += `M${P(along(line, t, -w))}L${P(tip)}L${P(along(line, t, w))}`;
    } else if (kind === 'twist') {
      d += `M${P(along(line, t, -w))}L${P(along(line, t + every * 0.6, w))}`;
    } else {
      const mid = along(line, t + every * 0.12);
      d += `M${P(along(line, t, -w))}Q${P(mid)} ${P(along(line, t, w))}`;
    }
  }
  return d;
}

/** A coil mark: a small open spiral/C (texture cue for coily hair). */
export function coil(x: number, y: number, r: number, turn = 1) {
  return `M${P([x - r, y])}A${f(r)} ${f(r)} 0 1 ${turn > 0 ? '1' : '0'} ${P([x + r * 0.6, y + r * 0.7])}`;
}

/** Spiral (Bantu knot wrap) around a centre. */
export function spiral(cx: number, cy: number, r: number, turns = 1.6) {
  const pts: Pt[] = [];
  const steps = Math.round(turns * 14);
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * turns * Math.PI * 2;
    const rr = r * (0.15 + (0.85 * i) / steps);
    pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.9]);
  }
  return smoothOpen(pts);
}

/** Organic blob (vitiligo patch, highlight cluster) around a centre. */
export function blob(cx: number, cy: number, rx: number, ry: number, seed: number, points = 7) {
  const random = rng(seed);
  const pts: Pt[] = [];
  for (let i = 0; i < points; i++) {
    const a = (i / points) * Math.PI * 2;
    const k = 0.72 + random() * 0.4;
    pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]);
  }
  return smoothClosed(pts);
}

/** Point on an ellipse at angle a (radians, 0 = right, positive = down). */
export const onEllipse = (cx: number, cy: number, rx: number, ry: number, a: number): Pt => [
  cx + Math.cos(a) * rx,
  cy + Math.sin(a) * ry,
];
