import { lerpKey } from './plan';
import { restKey, type KeyPose } from './types';

const channels = ['lift', 'dx', 'dy', 'rot', 'sleep'] as const;
const unit = (v: number) => Math.max(0, Math.min(1, v));

/** Estimate only from adjacent rendered frames; stale/reversed clocks carry no momentum. */
export function keyVelocity(previous: KeyPose, current: KeyPose, dt: number): KeyPose {
  if (!Number.isFinite(dt) || dt <= 0 || dt > 0.1) return restKey;
  const result: KeyPose = { ...restKey, pose: {} };
  for (const channel of channels) result[channel] = (current[channel] - previous[channel]) / dt;
  for (const channel of new Set([
    ...Object.keys(previous.pose),
    ...Object.keys(current.pose),
  ]) as Set<keyof KeyPose['pose']>)
    result.pose[channel] = ((current.pose[channel] ?? 0) - (previous.pose[channel] ?? 0)) / dt;
  if (previous.handSupport !== undefined || current.handSupport !== undefined)
    result.handSupport = ((current.handSupport ?? 0) - (previous.handSupport ?? 0)) / dt;
  return result;
}

/** Match incoming velocity, then yield smoothly to the new time-addressable plan.
 * Contact/face weights remain bounded; unconstrained channels retain C1 continuity.
 */
export function handoffKey(
  from: KeyPose,
  target: KeyPose,
  velocity: KeyPose,
  elapsed: number,
  duration: number,
): KeyPose {
  if (!Number.isFinite(elapsed) || !Number.isFinite(duration) || duration <= 0)
    throw new Error('Invalid pose handoff time.');
  const u = unit(elapsed / duration);
  if (u >= 1) return target;
  const mix = u ** 3 * (10 - 15 * u + 6 * u * u);
  const carry = duration * u * (1 - u) ** 3 * (1 + 3 * u);
  const result = lerpKey(from, target, mix);
  for (const channel of channels) result[channel] += velocity[channel] * carry;
  for (const channel of Object.keys(velocity.pose) as (keyof KeyPose['pose'])[])
    result.pose[channel] = (result.pose[channel] ?? 0) + (velocity.pose[channel] ?? 0) * carry;
  result.sleep = unit(result.sleep);
  if (result.handSupport !== undefined || velocity.handSupport !== undefined)
    result.handSupport = unit((result.handSupport ?? 0) + (velocity.handSupport ?? 0) * carry);
  return result;
}
