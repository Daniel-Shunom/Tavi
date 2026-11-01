import type { BodyControls } from './body';
/** C2-continuous envelope with a longer exhale; time-addressable, no integration history. */
export function settleWeight(value: number) {
  if (!Number.isFinite(value)) throw new Error('Invalid settling weight.');
  const t = Math.max(0, Math.min(1, value));
  return t * t * t * (10 + t * (-15 + 6 * t));
}
export function sleepEnvelope(time: number) {
  if (!Number.isFinite(time)) throw new Error('Invalid sleep time.');
  const phase = (((time % 4) + 4) % 4) / 4;
  return phase < 0.4 ? settleWeight(phase / 0.4) : 1 - settleWeight((phase - 0.4) / 0.6);
}
export function sleepControls(time: number, weight: number, reducedMotion = false): BodyControls {
  if (!Number.isFinite(weight)) throw new Error('Invalid sleep weight.');
  const w = settleWeight(weight),
    breath = w === 0 || reducedMotion ? 0 : (sleepEnvelope(time) - 0.5) * w;
  return {
    chestTilt: breath * 0.008,
    neckTilt: breath * 0.003,
    headStabilize: w,
    headSupport: w,
    sleepSupport: w,
  };
}
