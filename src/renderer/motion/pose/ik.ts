// Hand placement for posing: solves the shoulder and elbow channels that put a hand on a target
// (a ledge, a knee, the chin). Two-bone analytic IK on the proxy rig; rigs without elbows aim the
// straight arm at the target instead.
import type { Pose } from '../types';
import { joints, unplace, type Placement, type ProxyRig, type Vec } from './proxy';

/** Which way the elbow points when two solutions exist. */
export type Bend = 'out' | 'in' | 'down' | 'up';

const TAU = Math.PI * 2;
/** Arm channels live in [-1, 2π - 1): down-and-across is slightly negative, overhead about 2.5. */
const wrapArm = (a: number) => ((((a + 1) % TAU) + TAU) % TAU) - 1;
const wrapPi = (a: number) => a - TAU * Math.round(a / TAU);

/** Straight-chain hand direction relative to the upper arm for a forearm bend `beta`. */
function chainOffset(rig: ProxyRig, beta: number) {
  return Math.atan2(rig.foreArm * Math.sin(beta), rig.upperArm + rig.foreArm * Math.cos(beta));
}

export interface HandSolution {
  arm: number;
  elbow: number;
  /** Distance left between the hand and the target (BH); 0 when reached. */
  miss: number;
}

/**
 * Channels that put the hand of `side` on `target` (beat space) for a body posed by `pose` and
 * placed by `at`. The rest of the pose (lean, hips) is taken as given.
 */
export function solveHand(
  rig: ProxyRig,
  pose: Partial<Pose>,
  at: Placement,
  side: 'L' | 'R',
  target: Vec,
  bend: Bend = 'out',
): HandSolution {
  const goal = unplace(target, at);
  const body = joints(rig, pose);
  const shoulder = side === 'L' ? body.shoulderL : body.shoulderR;
  const lean = pose.lean ?? 0;
  const dx = goal.x - shoulder.x,
    dy = goal.y - shoulder.y;
  const toward = Math.atan2(dy, dx);
  const distance = Math.hypot(dx, dy);
  const u = rig.upperArm,
    f = rig.foreArm;
  const channel = (upper: number) =>
    wrapArm((upper + lean - rig.armRest[side]) * rig.armSign[side]);
  if (!rig.capabilities.elbows) {
    const upper = toward - chainOffset(rig, rig.foreRest[side]);
    const reach = Math.hypot(
      u + f * Math.cos(rig.foreRest[side]),
      f * Math.sin(rig.foreRest[side]),
    );
    return { arm: channel(upper), elbow: 0, miss: Math.abs(distance - reach) };
  }
  const d = Math.min(u + f - 1e-4, Math.max(Math.abs(u - f) + 1e-4, distance));
  const a = Math.acos(Math.min(1, Math.max(-1, (u * u + d * d - f * f) / (2 * u * d))));
  const options = [toward + a, toward - a].map((upper) => {
    const elbow = { x: shoulder.x + Math.cos(upper) * u, y: shoulder.y + Math.sin(upper) * u };
    const hand = {
      x: shoulder.x + Math.cos(toward) * d,
      y: shoulder.y + Math.sin(toward) * d,
    };
    const fore = Math.atan2(hand.y - elbow.y, hand.x - elbow.x);
    return { upper, fore, elbow };
  });
  const outward = side === 'L' ? -1 : 1;
  const score = (o: (typeof options)[number]) =>
    bend === 'out'
      ? o.elbow.x * outward
      : bend === 'in'
        ? -o.elbow.x * outward
        : bend === 'down'
          ? -o.elbow.y
          : o.elbow.y;
  const [first, second] = options;
  const best = first && second ? (score(first) >= score(second) ? first : second) : first;
  if (!best) return { arm: 0, elbow: 0, miss: distance };
  const elbow = wrapPi(best.fore - best.upper - rig.foreRest[side]) / rig.elbowSign[side];
  return { arm: channel(best.upper), elbow, miss: Math.abs(distance - d) };
}

/**
 * Fallback for rigs without elbows: turns each shoulder so the straight arm points where the bent
 * arm's hand would be (hand poses and the draw switch are simply ignored by such rigs).
 */
export function foldElbows(rig: ProxyRig, pose: Partial<Pose>): Partial<Pose> {
  const out = { ...pose };
  for (const side of ['L', 'R'] as const) {
    const elbowKey = side === 'L' ? 'elbowL' : 'elbowR';
    const armKey = side === 'L' ? 'armL' : 'armR';
    const elbow = pose[elbowKey] ?? 0;
    if (!elbow) continue;
    const bent = rig.foreRest[side] + rig.elbowSign[side] * elbow;
    const turn = chainOffset(rig, bent) - chainOffset(rig, rig.foreRest[side]);
    out[armKey] = (pose[armKey] ?? 0) + turn / rig.armSign[side];
    out[elbowKey] = 0;
  }
  return out;
}
