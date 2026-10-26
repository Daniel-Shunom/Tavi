// Deterministic, seedable randomness. Every random decision in the motion layer is derived
// from (seed, label, index) so two renderers with the same seed and clock make the same choices.

function hashString(text: string, seed: number) {
  let h1 = 0xdeadbeef ^ seed,
    h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h1 ^ h2) >>> 0;
}

function mulberry32(state: number) {
  let a = state >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type Rng = () => number;

/** A reproducible stream for one subsystem. */
export function rngFor(seed: number, label: string): Rng {
  return mulberry32(hashString(label, seed));
}

/** A single reproducible value in [0, 1) for (seed, label, index). */
export function random(seed: number, label: string, index: number) {
  return mulberry32(hashString(label + '#' + String(index), seed))();
}

export function range(rng: Rng, min: number, max: number) {
  return min + (max - min) * rng();
}

/** Exponentially distributed interval (Poisson process) with the given mean, clamped. */
export function exponential(rng: Rng, mean: number, min = 0, max = Infinity) {
  const value = -Math.log(1 - rng()) * mean;
  return Math.min(max, Math.max(min, value));
}

/** Weighted choice that never returns `exclude` unless it is the only option. */
export function pick<T extends string>(
  rng: Rng,
  options: readonly { id: T; weight: number }[],
  exclude?: T,
): T {
  const pool = options.filter((o) => o.weight > 0 && (o.id !== exclude || options.length === 1));
  const total = pool.reduce((sum, o) => sum + o.weight, 0);
  let roll = rng() * total;
  for (const option of pool) {
    roll -= option.weight;
    if (roll < 0) return option.id;
  }
  const last = pool.at(-1) ?? options[0];
  if (!last) throw new Error('pick() needs at least one option');
  return last.id;
}
