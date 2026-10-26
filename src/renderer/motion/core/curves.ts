// Shaping curves. All are pure functions of time so they are deterministic and frame-rate free.

export const clamp01 = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export function smoothstep(x: number) {
  const t = clamp01(x);
  return t * t * (3 - 2 * t);
}

/** Quintic; zero first and second derivative at both ends (C2). */
export function smootherstep(x: number) {
  const t = clamp01(x);
  return t * t * t * (t * (t * 6 - 15) + 10);
}

export function easeOutCubic(x: number) {
  const t = 1 - clamp01(x);
  return 1 - t * t * t;
}

export function easeInCubic(x: number) {
  const t = clamp01(x);
  return t * t * t;
}

/** Damped decay toward 1 from `from`, used for the settle after an overshoot. */
export function easeOutBack(x: number, amount = 1.4) {
  const t = clamp01(x) - 1;
  return 1 + t * t * ((amount + 1) * t + amount);
}

/**
 * Timing of one reaction, in seconds (amounts are fractions of full intensity).
 * anticipation -> attack -> overshoot/settle -> hold -> release.
 */
export interface ReactionShape {
  anticipation: number;
  attack: number;
  /** Peak above 1 reached at the end of the attack. */
  overshoot: number;
  settle: number;
  /** Seconds at full value; Infinity holds until released by the caller. */
  hold: number;
  release: number;
  /** Counter-movement during anticipation (default 0.12). */
  dip?: number;
}

/** Envelope in roughly [-dip, 1 + overshoot]; 0 before start and after release. */
export function reactionCurve(t: number, shape: ReactionShape) {
  if (t <= 0) return 0;
  const dip = shape.dip ?? 0.12;
  let edge = shape.anticipation;
  if (t < edge) return -dip * smootherstep(t / Math.max(1e-6, shape.anticipation));
  const peak = 1 + shape.overshoot;
  if (t < edge + shape.attack)
    return lerp(-dip, peak, smootherstep((t - edge) / Math.max(1e-6, shape.attack)));
  edge += shape.attack;
  if (t < edge + shape.settle)
    return lerp(peak, 1, smootherstep((t - edge) / Math.max(1e-6, shape.settle)));
  edge += shape.settle;
  if (t < edge + shape.hold) return 1;
  edge += shape.hold;
  if (t < edge + shape.release) return 1 - smootherstep((t - edge) / Math.max(1e-6, shape.release));
  return 0;
}

/** Total length of a reaction (Infinity when held). */
export function reactionLength(shape: ReactionShape) {
  return shape.anticipation + shape.attack + shape.settle + shape.hold + shape.release;
}
