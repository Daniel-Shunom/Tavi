// 1D gradient noise with Perlin's improved quintic fade (6t^5 - 15t^4 + 10t^3), seeded per channel.
// Used for idle sway at incommensurate slow frequencies so loops never visibly repeat.
import { random } from './random';

const gradientCache = new Map<string, number>();

function gradient(seed: number, lattice: number) {
  const key = String(seed) + ':' + String(lattice);
  let value = gradientCache.get(key);
  if (value === undefined) {
    value = random(seed, 'noise', lattice) * 2 - 1;
    if (gradientCache.size > 4096) gradientCache.clear();
    gradientCache.set(key, value);
  }
  return value;
}

function fade(t: number) {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

/** Smooth noise in [-1, 1]; unit lattice spacing. */
export function noise1(seed: number, x: number) {
  const i = Math.floor(x);
  const f = x - i;
  const a = gradient(seed, i) * f;
  const b = gradient(seed, i + 1) * (f - 1);
  const value = 2 * (a + (b - a) * fade(f));
  return Math.max(-1, Math.min(1, value));
}

/** Fractal sum of octaves, normalised to roughly [-1, 1]. */
export function fbm1(seed: number, x: number, octaves = 2) {
  let sum = 0,
    amplitude = 1,
    frequency = 1,
    norm = 0;
  for (let octave = 0; octave < octaves; octave++) {
    sum += amplitude * noise1(seed + octave * 101, x * frequency);
    norm += amplitude;
    amplitude *= 0.5;
    frequency *= 2.03;
  }
  return sum / norm;
}
