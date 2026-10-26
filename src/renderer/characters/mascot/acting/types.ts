// Shared types and key-building helpers for the mascot's acting data (face + head + body poses).
// Everything here is data: the face layer (src/renderer/face/) interprets it.
import type { z } from 'zod';
import type { ExpressionId } from '../../../../../shared/expressions';
import type { facePoseSchema } from '../../../face/pose';

export type ActingPose = z.input<typeof facePoseSchema>;
export type ActingPoses = Partial<Record<ExpressionId, ActingPose>>;
type Key = [number, number];

/** Quick 0 -> value -> 0 bumps at each (ascending, non-overlapping) time: giggles, taps. */
export function pulses(times: readonly number[], value: number, width = 0.16): Key[] {
  const keys: Key[] = [];
  for (const t of times) keys.push([t, 0], [t + width * 0.4, value], [t + width, 0]);
  return keys;
}

/** A decaying oscillation (head shakes, shivers): `count` swings of `amplitude`, `period` apart. */
export function shake(start: number, period: number, amplitude: number, count: number): Key[] {
  const keys: Key[] = [[start, 0]];
  for (let i = 0; i < count; i++) {
    const decay = 1 - i / (count + 1);
    keys.push([start + (i + 0.5) * period, (i % 2 === 0 ? 1 : -1) * amplitude * decay]);
  }
  keys.push([start + (count + 0.5) * period, 0]);
  return keys;
}

/** Hops: crouch, spring up, land, repeated (`bob` units: + crouch, - rise). */
export function hops(start: number, period: number, depth: number, count: number): Key[] {
  const keys: Key[] = [[start, 0]];
  for (let i = 0; i < count; i++) {
    const t = start + i * period;
    keys.push([t + period * 0.25, depth * 0.6], [t + period * 0.55, -depth], [t + period, 0]);
  }
  return keys;
}
