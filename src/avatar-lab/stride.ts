export type FootPoint = { y: number; z: number };
export type StrideSample = readonly [FootPoint, FootPoint];
export type StrideCurve = { duration: number; distances: number[]; distance: number };

/** Infer forward travel from low, backwards-moving feet in an in-place cycle.
 * Airborne intervals use mean stance speed. Units are the normalized scene's
 * units, so each character gets its own curve after its rig has been fitted.
 */
export function measureStride(samples: readonly StrideSample[], duration: number): StrideCurve {
  if (samples.length < 3 || duration <= 0)
    throw new Error('A stride needs a complete sampled cycle');
  const floor: [number, number] = [
    Math.min(...samples.map((sample) => sample[0].y)),
    Math.min(...samples.map((sample) => sample[1].y)),
  ];
  const steps: (number | null)[] = [];
  for (let i = 1; i < samples.length; i++) {
    const before = samples[i - 1];
    const after = samples[i];
    if (!before || !after) throw new Error('Missing stride sample');
    const candidates: { height: number; distance: number }[] = [];
    for (const side of [0, 1] as const) {
      const height = (before[side].y + after[side].y) / 2 - floor[side];
      const distance = before[side].z - after[side].z;
      if (height < 0.08 && distance > 0.00001 && distance < 0.2)
        candidates.push({ height, distance });
    }
    candidates.sort((a, b) => a.height - b.height);
    steps.push(candidates[0]?.distance ?? null);
  }
  const contacts = steps.filter((step): step is number => step !== null);
  if (contacts.length < steps.length * 0.1)
    throw new Error('Not enough stance contact to calibrate this cycle');
  const mean = contacts.reduce((sum, step) => sum + step, 0) / contacts.length;
  const distances = [0];
  let distance = 0;
  for (const step of steps) {
    distance += step ?? mean;
    distances.push(distance);
  }
  return { duration, distances, distance };
}

/** Unwrapped travel distance, including full cycles; independent of render fps. */
export function strideDistance(curve: StrideCurve, time: number): number {
  const cycles = time / curve.duration;
  const complete = Math.floor(cycles);
  const frame = (cycles - complete) * (curve.distances.length - 1);
  const index = Math.min(Math.floor(frame), curve.distances.length - 2);
  const fraction = frame - index;
  const before = curve.distances[index];
  const after = curve.distances[index + 1];
  if (before === undefined || after === undefined) throw new Error('Incomplete stride curve');
  return complete * curve.distance + before + (after - before) * fraction;
}
