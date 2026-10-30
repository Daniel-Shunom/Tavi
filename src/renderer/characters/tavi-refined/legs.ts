// Refined rig projection: feet keep the existing state/locomotion ownership.
export type Point = readonly [number, number];
export const THIGH = 71.474152,
  SHIN = 67.434799;
const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));
export function requiredItem<T>(items: readonly T[], index: number): T {
  const item = items[index];
  if (item === undefined) throw new Error('Missing refined rig joint at index ' + String(index));
  return item;
}
export function walkingKnees(hips: readonly Point[], feet: readonly Point[]): Point[] | null {
  let low = -Math.PI / 2,
    high = Math.PI / 2;
  for (let i = 0; i < 2; i++) {
    const h = requiredItem(hips, i),
      f = requiredItem(feet, i),
      dx = f[0] - h[0],
      dy = f[1] - h[1],
      d = Math.hypot(dx, dy);
    if (d > THIGH + SHIN || d < 1e-5) return null;
    const angle = Math.atan2(dx, dy),
      half = Math.acos(clamp((d * d + SHIN * SHIN - THIGH * THIGH) / (2 * SHIN * d), -1, 1));
    low = Math.max(low, angle - half);
    high = Math.min(high, angle + half);
  }
  if (low > high + 1e-6) return null;
  const lean = clamp(0, low, high),
    x = SHIN * Math.sin(lean),
    y = SHIN * Math.cos(lean);
  return feet.map((f) => [f[0] - x, f[1] - y]);
}
export function liftedKnee(h: Point, f: Point): Point {
  const dx = f[0] - h[0],
    dy = f[1] - h[1],
    d = Math.max(0.001, Math.hypot(dx, dy));
  const along = (THIGH * THIGH - SHIN * SHIN + d * d) / (2 * d),
    r = Math.sqrt(Math.max(0, THIGH * THIGH - along * along));
  const center = h[0] + (along * dx) / d,
    extent = (r * Math.abs(dy)) / d;
  const x = clamp(h[0] + clamp(0.3 * dx, -14, 14), center - extent, center + extent);
  const a = Math.sqrt(Math.max(0, THIGH * THIGH - (x - h[0]) ** 2)),
    b = Math.sqrt(Math.max(0, SHIN * SHIN - (f[0] - x) ** 2));
  const low = Math.max(h[1] - a, f[1] - b),
    high = Math.min(h[1] + a, f[1] + b);
  return [x, low + 0.18 * (high - low)];
}
