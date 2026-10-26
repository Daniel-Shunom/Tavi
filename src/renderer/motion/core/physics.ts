// One gravity for every airborne phase (hops, jumps, drops) so the character always has the
// same weight. Units: body heights (BH) and seconds. A chibi is roughly a metre tall, so
// g = 9.8 BH/s^2: a 0.12 BH hop lasts ~0.31 s, a fall from the top of a 720p canvas ~0.9 s.
export const G_BH = 9.8;

/** Time in the air for a hop with apex `height` (BH). */
export function airtime(height: number) {
  return 2 * Math.sqrt((2 * Math.max(0, height)) / G_BH);
}

/** Apex (BH) of a hop that stays in the air for `seconds`. */
export function apexFor(seconds: number) {
  return (G_BH * seconds * seconds) / 8;
}

/** Height above the start of a ballistic hop at `t` seconds with total airtime `T`. */
export function hopHeight(t: number, T: number) {
  if (t <= 0 || t >= T) return 0;
  return (G_BH * t * (T - t)) / 2;
}

/** Seconds to fall `height` BH from rest. */
export function fallTime(height: number) {
  return Math.sqrt((2 * Math.max(0, height)) / G_BH);
}

/** Speed (BH/s) on landing after falling `height` BH from rest. */
export function impactSpeed(height: number) {
  return Math.sqrt(2 * G_BH * Math.max(0, height));
}
