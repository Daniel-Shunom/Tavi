// Kinematic proxy of a character rig: where the joints, hands, soles, seat and head end up for a
// pose, in rest space (body heights from the soles' centre, +x screen right, +y up). It is a
// measured model of the real rig (tools/pose-lab/measure.html reads bone world transforms through
// the production binding), so pose checks and the hand solver run without a renderer.
// Units and channel conventions: motion/types.ts.
import type { Pose } from '../types';

export interface Vec {
  x: number;
  y: number;
}

/** Measured geometry and capabilities of a rig (rest pose, rest space). */
export interface ProxyRig {
  id: string;
  /** Hips (body node), torso pivot (upper node) and neck (head node pivot). */
  hips: Vec;
  torso: Vec;
  neck: Vec;
  shoulders: { L: Vec; R: Vec };
  upperArm: number;
  /** Forearm plus the hand (to the knuckles). */
  foreArm: number;
  /** Half the hand's height: a hand resting on a surface has its knuckles this far above it. */
  handRadius: number;
  /** World angle of each upper arm at rest (rad, counter-clockwise from +x). */
  armRest: { L: number; R: number };
  /** Forearm angle relative to the upper arm at rest. */
  foreRest: { L: number; R: number };
  /** World rotation per unit of armL/armR and elbowL/elbowR (+1 counter-clockwise). */
  armSign: { L: number; R: number };
  elbowSign: { L: number; R: number };
  legRoots: { L: Vec; R: Vec };
  thigh: number;
  shin: number;
  /** Foot IK targets at rest; the sole is `soleDrop` below the target. */
  feet: { L: Vec; R: Vec };
  soleDrop: number;
  /** Head ellipse: centre relative to the neck pivot, radii. */
  head: { centre: Vec; rx: number; ry: number };
  /** Skirt hem below the hips (seat contact). */
  seatBelowHips: number;
  /** Half widths of the torso at the shoulders and at the hem. */
  torsoHalf: { top: number; hem: number };
  capabilities: { elbows: boolean; hands: boolean; armsFront: boolean };
}

/** Root placement of a pose (body-state KeyPose convention). */
export interface Placement {
  /** Root height above the beat's floor line (BH). */
  lift: number;
  /** Pose-local offset (+x toward facing, +y down), BH. */
  dx: number;
  dy: number;
  /** Rotation about the soles, degrees, + clockwise. */
  rot: number;
  /** Host squash about the soles. */
  scaleX: number;
  scaleY: number;
}
export const restPlacement: Placement = { lift: 0, dx: 0, dy: 0, rot: 0, scaleX: 1, scaleY: 1 };

export interface Joints {
  hips: Vec;
  torso: Vec;
  neck: Vec;
  head: { centre: Vec; rx: number; ry: number; angle: number };
  shoulderL: Vec;
  shoulderR: Vec;
  elbowL: Vec;
  elbowR: Vec;
  handL: Vec;
  handR: Vec;
  kneeL: Vec;
  kneeR: Vec;
  soleL: Vec;
  soleR: Vec;
  seat: Vec;
  /** Torso outline: shoulder corners then hem corners. */
  torsoQuad: [Vec, Vec, Vec, Vec];
  /** Area-weighted centre of mass. */
  com: Vec;
}

const v = (x: number, y: number): Vec => ({ x, y });
const add = (a: Vec, b: Vec) => v(a.x + b.x, a.y + b.y);
const sub = (a: Vec, b: Vec) => v(a.x - b.x, a.y - b.y);
const scale = (a: Vec, k: number) => v(a.x * k, a.y * k);
const len = (a: Vec) => Math.hypot(a.x, a.y);
const polar = (angle: number, r: number) => v(Math.cos(angle) * r, Math.sin(angle) * r);
/** Rotate about a pivot, counter-clockwise by `angle` (rad). */
export function rotateAbout(p: Vec, pivot: Vec, angle: number): Vec {
  const c = Math.cos(angle),
    s = Math.sin(angle);
  const d = sub(p, pivot);
  return v(pivot.x + d.x * c - d.y * s, pivot.y + d.x * s + d.y * c);
}

/** Rest space -> beat space (placement applied about the soles). */
export function place(p: Vec, at: Placement): Vec {
  const r = (at.rot * Math.PI) / 180;
  const x = p.x * at.scaleX,
    y = p.y * at.scaleY;
  return v(
    x * Math.cos(r) + y * Math.sin(r) + at.dx,
    -x * Math.sin(r) + y * Math.cos(r) - at.dy + at.lift,
  );
}
/** Beat space -> rest space (inverse of `place`). */
export function unplace(p: Vec, at: Placement): Vec {
  const r = (at.rot * Math.PI) / 180;
  const x = p.x - at.dx,
    y = p.y + at.dy - at.lift;
  return v(
    (x * Math.cos(r) - y * Math.sin(r)) / at.scaleX,
    (x * Math.sin(r) + y * Math.cos(r)) / at.scaleY,
  );
}

function legKnee(rig: ProxyRig, root: Vec, foot: Vec) {
  const d = Math.min(rig.thigh + rig.shin - 1e-6, Math.max(1e-6, len(sub(foot, root))));
  const toward = Math.atan2(foot.y - root.y, foot.x - root.x);
  const cos = (rig.thigh * rig.thigh + d * d - rig.shin * rig.shin) / (2 * rig.thigh * d);
  // Knees bend toward +x (the rig's IK bend side, measured).
  return add(root, polar(toward + Math.acos(Math.max(-1, Math.min(1, cos))), rig.thigh));
}

const value = (pose: Partial<Pose>, channel: keyof Pose) => pose[channel] ?? 0;

/** Upper-arm and forearm world angles for a pose (before placement). */
export function armAngles(rig: ProxyRig, pose: Partial<Pose>, side: 'L' | 'R') {
  const lean = value(pose, 'lean');
  const arm = value(pose, side === 'L' ? 'armL' : 'armR');
  const elbow = rig.capabilities.elbows ? value(pose, side === 'L' ? 'elbowL' : 'elbowR') : 0;
  const upper = rig.armRest[side] + rig.armSign[side] * arm - lean;
  const fore = upper + rig.foreRest[side] + rig.elbowSign[side] * elbow;
  return { upper, fore };
}

/** Joint positions of `pose` in beat space (rest space when `at` is the rest placement). */
export function joints(rig: ProxyRig, pose: Partial<Pose>, at: Placement = restPlacement): Joints {
  const body = v(value(pose, 'shift'), -value(pose, 'bob'));
  const lean = value(pose, 'lean');
  const tilt = value(pose, 'headTilt');
  const hips = add(rig.hips, body);
  const torso = add(rig.torso, body);
  // Torso lean: + tips the top toward +x (clockwise).
  const lean0 = (p: Vec) => rotateAbout(add(p, body), torso, -lean);
  const neck = add(lean0(rig.neck), v(0, -value(pose, 'headY')));
  const headCentre = rotateAbout(add(neck, rig.head.centre), neck, -(lean + tilt));
  const shoulderL = lean0(rig.shoulders.L),
    shoulderR = lean0(rig.shoulders.R);
  const arm = (side: 'L' | 'R', shoulder: Vec) => {
    const { upper, fore } = armAngles(rig, pose, side);
    const elbow = add(shoulder, polar(upper, rig.upperArm));
    return { elbow, hand: add(elbow, polar(fore, rig.foreArm)) };
  };
  const L = arm('L', shoulderL),
    R = arm('R', shoulderR);
  const footL = add(rig.feet.L, v(value(pose, 'footLX'), value(pose, 'footLY')));
  const footR = add(rig.feet.R, v(value(pose, 'footRX'), value(pose, 'footRY')));
  const rootL = add(rig.legRoots.L, body),
    rootR = add(rig.legRoots.R, body);
  const kneeL = legKnee(rig, rootL, footL),
    kneeR = legKnee(rig, rootR, footR);
  const soleL = v(footL.x, footL.y - rig.soleDrop),
    soleR = v(footR.x, footR.y - rig.soleDrop);
  const seat = v(hips.x, hips.y - rig.seatBelowHips);
  const torsoQuad: [Vec, Vec, Vec, Vec] = [
    v(shoulderL.x - 0.02, shoulderL.y),
    v(shoulderR.x + 0.02, shoulderR.y),
    v(hips.x + rig.torsoHalf.hem, seat.y),
    v(hips.x - rig.torsoHalf.hem, seat.y),
  ];
  // Area-weighted centre of mass: the head dominates (measured silhouette centroid 0.47 BH).
  const parts: [Vec, number][] = [
    [headCentre, Math.PI * rig.head.rx * rig.head.ry],
    [scale(add(add(torsoQuad[0], torsoQuad[1]), add(torsoQuad[2], torsoQuad[3])), 0.25), 0.035],
    [scale(add(add(rootL, kneeL), add(kneeL, footL)), 0.25), 0.009],
    [scale(add(add(rootR, kneeR), add(kneeR, footR)), 0.25), 0.009],
    [scale(add(shoulderL, L.hand), 0.5), 0.006],
    [scale(add(shoulderR, R.hand), 0.5), 0.006],
  ];
  const mass = parts.reduce((sum, [, m]) => sum + m, 0);
  const com = scale(
    parts.reduce((sum, [p, m]) => add(sum, scale(p, m)), v(0, 0)),
    1 / mass,
  );
  const P = (p: Vec) => place(p, at);
  return {
    hips: P(hips),
    torso: P(torso),
    neck: P(neck),
    head: {
      centre: P(headCentre),
      rx: rig.head.rx * at.scaleX,
      ry: rig.head.ry * at.scaleY,
      angle: -(lean + tilt) - (at.rot * Math.PI) / 180,
    },
    shoulderL: P(shoulderL),
    shoulderR: P(shoulderR),
    elbowL: P(L.elbow),
    elbowR: P(R.elbow),
    handL: P(L.hand),
    handR: P(R.hand),
    kneeL: P(kneeL),
    kneeR: P(kneeR),
    soleL: P(soleL),
    soleR: P(soleR),
    seat: P(seat),
    torsoQuad: torsoQuad.map(P) as [Vec, Vec, Vec, Vec],
    com: P(com),
  };
}

/** Inside the (rotated) head ellipse, with a margin in BH (negative = shrink). */
export function insideHead(head: Joints['head'], p: Vec, margin = 0) {
  const d = rotateAbout(p, head.centre, -head.angle);
  const x = (d.x - head.centre.x) / (head.rx + margin),
    y = (d.y - head.centre.y) / (head.ry + margin);
  return x * x + y * y <= 1;
}
/** Extreme point of the head ellipse in a direction (unit vector), e.g. the side touching a wall. */
export function headExtreme(head: Joints['head'], direction: Vec): Vec {
  // Support point of a rotated ellipse.
  const c = Math.cos(-head.angle),
    s = Math.sin(-head.angle);
  const local = v(direction.x * c - direction.y * s, direction.x * s + direction.y * c);
  const n = Math.hypot(head.rx * local.x, head.ry * local.y) || 1;
  const p = v((head.rx * head.rx * local.x) / n, (head.ry * head.ry * local.y) / n);
  return add(head.centre, rotateAbout(p, v(0, 0), head.angle));
}

/** Point-in-convex-quad test (torso). */
export function insideQuad(quad: readonly Vec[], p: Vec) {
  let sign = 0;
  for (let i = 0; i < quad.length; i++) {
    const a = quad[i],
      b = quad[(i + 1) % quad.length];
    if (!a || !b) continue;
    const cross = (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
    if (cross !== 0) {
      if (sign === 0) sign = Math.sign(cross);
      else if (Math.sign(cross) !== sign) return false;
    }
  }
  return true;
}
