/** Rig-local units; screen pixels must never enter a limb solve. */
export type Vec2 = readonly [number, number];
export const distance = (a: Vec2, b: Vec2) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

export interface LimbSolution {
  joint: Vec2;
  end: Vec2;
  /** Distance from requested target to reachable endpoint. */
  error: number;
}

/** Exact rigid two-bone IK. Bend is explicit and remains stable at full extension. */
export function solveLimb(
  root: Vec2,
  target: Vec2,
  upper: number,
  lower: number,
  bend: -1 | 1 = 1,
  fallbackAngle = Math.PI / 2,
): LimbSolution {
  if (
    ![...root, ...target, upper, lower, fallbackAngle].every(Number.isFinite) ||
    upper <= 0 ||
    lower <= 0
  )
    throw new Error('A limb needs finite coordinates and positive lengths.');
  const dx = target[0] - root[0],
    dy = target[1] - root[1];
  const requested = Math.hypot(dx, dy);
  const angle = requested > 1e-10 ? Math.atan2(dy, dx) : fallbackAngle;
  const ux = Math.cos(angle),
    uy = Math.sin(angle);
  const reach = clamp(requested, Math.abs(upper - lower), upper + lower);
  // Equal-length fully folded limbs have infinitely many solutions: retain the bend axis.
  const along = reach > 1e-10 ? (upper * upper - lower * lower + reach * reach) / (2 * reach) : 0;
  const height = Math.sqrt(Math.max(0, upper * upper - along * along));
  return {
    joint: [root[0] + ux * along - uy * height * bend, root[1] + uy * along + ux * height * bend],
    end: [root[0] + ux * reach, root[1] + uy * reach],
    error: Math.abs(requested - reach),
  };
}

export interface Support {
  root: Vec2;
  target: Vec2;
  reach: number;
}
/** Common pelvis translation into the intersection of limb-reach disks.
 * Targets stay fixed. The residual is explicit when support disks are incompatible.
 */
export function projectSupport(supports: readonly Support[], iterations = 64) {
  if (!Number.isInteger(iterations) || iterations < 1)
    throw new Error('Invalid support iteration budget.');
  for (const s of supports)
    if (![...s.root, ...s.target, s.reach].every(Number.isFinite) || s.reach <= 0)
      throw new Error('Invalid contact support.');
  // The nearest point of a convex disk intersection is either a single-disk
  // projection or an intersection of two boundaries. Enumerating these in 2D
  // avoids contact-order bias and iterative drift in ordinary compatible rigs.
  const disks = supports.map((s) => ({
    center: [s.target[0] - s.root[0], s.target[1] - s.root[1]] as Vec2,
    radius: s.reach,
  }));
  const candidates: Vec2[] = [[0, 0]];
  for (const disk of disks) {
    const d = Math.hypot(...disk.center);
    if (d > 1e-10)
      candidates.push([
        disk.center[0] * (1 - disk.radius / d),
        disk.center[1] * (1 - disk.radius / d),
      ]);
  }
  for (const [i, a] of disks.entries())
    for (const b of disks.slice(i + 1)) {
      const dx = b.center[0] - a.center[0],
        dy = b.center[1] - a.center[1],
        d = Math.hypot(dx, dy);
      if (d < 1e-10 || d > a.radius + b.radius || d < Math.abs(a.radius - b.radius)) continue;
      const along = (a.radius ** 2 - b.radius ** 2 + d ** 2) / (2 * d);
      const height = Math.sqrt(Math.max(0, a.radius ** 2 - along ** 2));
      for (const sign of [-1, 1])
        candidates.push([
          a.center[0] + (dx / d) * along - (dy / d) * height * sign,
          a.center[1] + (dy / d) * along + (dx / d) * height * sign,
        ]);
    }
  const feasible = candidates.filter((p) =>
    disks.every((d) => distance(p, d.center) <= d.radius + 1e-8),
  );
  feasible.sort((a, b) => Math.hypot(...a) - Math.hypot(...b) || a[0] - b[0] || a[1] - b[1]);
  const best = feasible[0];
  if (best)
    return {
      offset: best,
      residual: Math.max(0, ...disks.map((d) => distance(best, d.center) - d.radius)),
    };
  // Incompatible contacts still produce a finite answer and an explicit residual.
  let x = 0,
    y = 0;
  for (let i = 0; i < iterations; i++) {
    let largest = 0;
    for (const s of supports) {
      const dx = s.root[0] + x - s.target[0],
        dy = s.root[1] + y - s.target[1];
      const d = Math.hypot(dx, dy),
        excess = Math.max(0, d - s.reach);
      largest = Math.max(largest, excess);
      if (excess > 1e-9) {
        x -= (dx * excess) / d;
        y -= (dy * excess) / d;
      }
    }
    if (largest < 1e-8) break;
  }
  const offset: Vec2 = [x, y];
  const residual = Math.max(
    0,
    ...supports.map((s) => distance([s.root[0] + x, s.root[1] + y], s.target) - s.reach),
  );
  return { offset, residual };
}

/** Exponential extension easing with matched value/slope at the soft zone. */
export function softReach(requested: number, maximum: number, softness = 8) {
  if (
    ![requested, maximum, softness].every(Number.isFinite) ||
    requested < 0 ||
    maximum <= 0 ||
    softness <= 0 ||
    softness >= maximum
  )
    throw new Error('Invalid soft reach.');
  const threshold = maximum - softness;
  return requested <= threshold
    ? requested
    : threshold + softness * (1 - Math.exp(-(requested - threshold) / softness));
}
