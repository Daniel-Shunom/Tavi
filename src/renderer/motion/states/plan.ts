// Transition plans for body states: keyframed segments between key poses, with ballistic
// segments on the shared gravity (core/physics.ts) for jumps onto and off ledges. Pure: the same
// cue, rig and stage always give the same plan, so studio and overlay agree.
import type { BodyStateId, Spot } from '../../../../shared/states';
import { G_BH } from '../core/physics';
import { holdPose } from '../pose/runtime';
import type { Beat } from '../pose/schema';
import type { Pose } from '../types';
import { restKey, type ContactPoint, type KeyName, type KeyPose, type StateRig } from './types';

export type Ease = 'linear' | 'in' | 'out' | 'inOut';
export interface Segment {
  at: number;
  dur: number;
  from: KeyPose;
  to: KeyPose;
  ease: Ease;
  /** Ballistic root lift: apex height (BH); pose blends with a mid-air tuck. */
  ballistic?: { apex: number; tuck: Partial<Pose> };
}
export interface Timeline {
  segments: Segment[];
  duration: number;
  end: KeyPose;
}

export function ease(kind: Ease, x: number) {
  const t = Math.min(1, Math.max(0, x));
  switch (kind) {
    case 'linear':
      return t;
    case 'in':
      return t * t * t;
    case 'out':
      return 1 - (1 - t) ** 3;
    case 'inOut':
      // Smootherstep: zero velocity and acceleration at both ends (no jerks at key poses).
      return t * t * t * (t * (6 * t - 15) + 10);
  }
}

export function lerpPose(a: Partial<Pose>, b: Partial<Pose>, k: number): Partial<Pose> {
  const out: Partial<Pose> = {};
  for (const key of new Set([...Object.keys(a), ...Object.keys(b)]) as Set<keyof Pose>)
    out[key] = (a[key] ?? 0) + ((b[key] ?? 0) - (a[key] ?? 0)) * k;
  return out;
}
export function lerpKey(a: KeyPose, b: KeyPose, k: number): KeyPose {
  return {
    pose: lerpPose(a.pose, b.pose, k),
    lift: a.lift + (b.lift - a.lift) * k,
    dx: a.dx + (b.dx - a.dx) * k,
    dy: a.dy + (b.dy - a.dy) * k,
    rot: a.rot + (b.rot - a.rot) * k,
    sleep: a.sleep + (b.sleep - a.sleep) * k,
  };
}
export function addPose(a: Partial<Pose>, b: Partial<Pose>, gain = 1): Partial<Pose> {
  const out: Partial<Pose> = { ...a };
  for (const [key, value] of Object.entries(b) as [keyof Pose, number][])
    out[key] = (out[key] ?? 0) + value * gain;
  return out;
}

/** Ballistic lift from L0 to L1 through `apex` on the shared gravity. */
export function ballisticTime(from: number, to: number, apex: number) {
  const top = Math.max(apex, from, to);
  return Math.sqrt((2 * (top - from)) / G_BH) + Math.sqrt((2 * (top - to)) / G_BH);
}
export function ballisticLift(t: number, from: number, to: number, apex: number) {
  const top = Math.max(apex, from, to);
  const up = Math.sqrt((2 * (top - from)) / G_BH);
  const v0 = G_BH * up;
  const total = ballisticTime(from, to, apex);
  const s = Math.min(total, Math.max(0, t));
  return from + v0 * s - (G_BH * s * s) / 2;
}

export function sampleTimeline(timeline: Timeline, t: number): KeyPose {
  const segments = timeline.segments;
  if (!segments.length || t >= timeline.duration) return timeline.end;
  const first = segments[0];
  if (first && t <= first.at) return first.from;
  for (const segment of segments) {
    if (t > segment.at + segment.dur) continue;
    const u = segment.dur > 0 ? (t - segment.at) / segment.dur : 1;
    if (segment.ballistic) {
      const key = lerpKey(segment.from, segment.to, ease('inOut', u));
      const tuck = Math.sin(Math.PI * Math.min(1, Math.max(0, u)));
      return {
        ...key,
        pose: addPose(
          addPose(key.pose, segment.ballistic.tuck, tuck),
          // Stretch on take-off, back to neutral by the apex.
          { squash: -0.6 * Math.max(0, 1 - 2.5 * u) },
        ),
        lift: ballisticLift(
          t - segment.at,
          segment.from.lift,
          segment.to.lift,
          segment.ballistic.apex,
        ),
      };
    }
    return lerpKey(segment.from, segment.to, ease(segment.ease, u));
  }
  return timeline.end;
}

// Plans ------------------------------------------------------------------------------------

export interface PlanContext {
  rig: StateRig;
  /** Height of the spot's edge above the floor (BH); 0 for floor spots. */
  gap: number;
  /** Horizontal distance from the soles to a lean edge (BH). */
  edgeDistance: number;
  reducedMotion: boolean;
  /** Posture variant (from the cue seed) when the state has several authored holds. */
  variant?: number;
}

/** The authored hold beat for a state at a spot, if the rig has one (variant by seed). */
export function holdBeat(state: BodyStateId, spot: Spot | null, context: PlanContext): Beat | null {
  const surface = spot?.surface ?? 'floor';
  const options = context.rig.holds?.[state]?.[surface];
  if (!options?.length) return null;
  return options[Math.abs(Math.round(context.variant ?? 0)) % options.length] ?? null;
}

class Builder {
  segments: Segment[] = [];
  t = 0;
  current: KeyPose;
  constructor(start: KeyPose) {
    this.current = start;
  }
  to(next: KeyPose, dur: number, ease: Ease = 'inOut') {
    this.segments.push({ at: this.t, dur, from: this.current, to: next, ease });
    this.t += dur;
    this.current = next;
    return this;
  }
  jump(next: KeyPose, apex: number, tuck: Partial<Pose>) {
    const dur = ballisticTime(this.current.lift, next.lift, apex);
    this.segments.push({
      at: this.t,
      dur,
      from: this.current,
      to: next,
      ease: 'linear',
      ballistic: { apex, tuck },
    });
    this.t += dur;
    this.current = next;
    return this;
  }
  /** Landing: squash and knee bend proportional to the impact speed, then recover. */
  land(on: KeyPose, fallHeight: number, recover = 0.25) {
    const impact = Math.sqrt(2 * G_BH * Math.max(0, fallHeight));
    const k = Math.min(1, impact / 3);
    const squashed = { ...on, pose: addPose(on.pose, { squash: 0.7 * k, bob: 0.06 * k }) };
    this.to(squashed, 0.06, 'out');
    return this.to(on, recover, 'out');
  }
  build(): Timeline {
    return { segments: this.segments, duration: this.t, end: this.current };
  }
}

export function key(rig: StateRig, name: KeyName | null, extra: Partial<KeyPose> = {}): KeyPose {
  return { ...restKey, pose: name ? { ...rig.keys[name] } : {}, ...extra };
}

/** Rotation (deg, + clockwise facing right) and pose-local raise that put both points on the floor. */
export function solveLie(head: ContactPoint, feet: ContactPoint) {
  // Rotating back by phi (counter-clockwise), y' = x sin(phi) + y cos(phi). Find phi where the
  // head's side and the feet are equally low (two contacts), then raise so they touch the floor.
  const low = (p: ContactPoint, phi: number) => p.x * Math.sin(phi) + p.y * Math.cos(phi);
  let a = 0.6,
    b = 1.45;
  for (let i = 0; i < 50; i++) {
    const m = (a + b) / 2;
    if (low(head, m) - low(feet, m) > 0) a = m;
    else b = m;
  }
  const phi = (a + b) / 2;
  const lowest = Math.min(low(head, phi), low(feet, phi));
  return { rot: (-phi * 180) / Math.PI, dy: lowest };
}
/** Rotation back toward an edge behind until the head touches it (deg, negative). */
export function solveLean(contact: ContactPoint, distance: number) {
  const reachAt = (theta: number) => -contact.x * Math.cos(theta) + contact.y * Math.sin(theta);
  const max = (18 * Math.PI) / 180;
  if (reachAt(0) >= distance) return -2;
  if (reachAt(max) <= distance) return -18;
  let a = 0,
    b = max;
  for (let i = 0; i < 40; i++) {
    const m = (a + b) / 2;
    if (reachAt(m) < distance) a = m;
    else b = m;
  }
  return (-((a + b) / 2) * 180) / Math.PI;
}

function sleepy(k: KeyPose): KeyPose {
  return { ...k, sleep: 1 };
}

/** The held key pose of a state at a spot (without hold life). */
export function heldKey(state: BodyStateId, spot: Spot | null, context: PlanContext): KeyPose {
  const base = heldKeyBase(state, spot, context);
  const hold = holdBeat(state, spot, context);
  return hold ? { ...base, pose: holdPose(hold) } : base;
}
function heldKeyBase(state: BodyStateId, spot: Spot | null, context: PlanContext): KeyPose {
  const { rig, gap } = context;
  const ledge = spot?.surface === 'ledge';
  switch (state) {
    case 'stand':
      return restKey;
    case 'sit':
      return ledge ? key(rig, 'sitLedge', { lift: gap - rig.seatHeight }) : key(rig, 'sitFloor');
    case 'doze':
      return sleepy(
        ledge ? key(rig, 'dozeLedge', { lift: gap - rig.seatHeight }) : key(rig, 'dozeFloor'),
      );
    case 'nap': {
      const lie = solveLie(rig.lieContacts.head, rig.lieContacts.feet);
      return sleepy(key(rig, 'lie', { rot: lie.rot, dy: lie.dy }));
    }
    case 'peek':
      return key(rig, 'peek');
    case 'perch':
      return key(rig, 'perch', { lift: gap });
    case 'lean':
      return key(rig, 'lean', { rot: solveLean(rig.leanContact, context.edgeDistance) });
  }
}

/** From standing at the spot's approach point into the state. */
export function enterPlan(state: BodyStateId, spot: Spot | null, context: PlanContext): Timeline {
  const { rig, gap } = context;
  const held = heldKey(state, spot, context);
  const b = new Builder(restKey);
  if (context.reducedMotion) return b.to(held, 0.5).build();
  const onTop = key(rig, null, { lift: gap });
  const jumpUp = () => {
    b.to(key(rig, 'crouch', { pose: { ...rig.keys.crouch, squash: 0.45 } }), 0.25);
    b.jump(onTop, gap + 0.12, rig.keys.airTuck);
    b.land(onTop, 0.12);
  };
  switch (state) {
    case 'stand':
      return b.build();
    case 'sit':
    case 'doze': {
      if (spot?.surface === 'ledge') {
        jumpUp();
        b.to(key(rig, null, { lift: gap, pose: { gazeY: 0.6, lean: 0.08 } }), 0.3);
        const seated = heldKey('sit', spot, context);
        b.to({ ...seated, pose: addPose(seated.pose, { squash: 0.15 }) }, 0.6, 'inOut');
        b.to({ ...seated, pose: addPose(seated.pose, { squash: 0.4 }) }, 0.08, 'out');
        b.to(seated, 0.25, 'out');
      } else sitDownFloor(b, rig, heldKey('sit', spot, context));
      if (state === 'doze') b.to(held, 2.0);
      return b.build();
    }
    case 'nap':
      sitDownFloor(b, rig);
      lieDown(b, rig, held);
      return b.build();
    case 'peek':
      return b.to(held, 0.6).build();
    case 'perch':
      jumpUp();
      return b.to(held, 0.5).build();
    case 'lean':
      b.to(key(rig, null, { pose: { gazeX: -0.6 } }), 0.4);
      b.to(held, 0.5);
      b.to({ ...held, pose: addPose(held.pose, { squash: 0.15, hairSquash: 0.3 }) }, 0.05, 'out');
      return b.to(held, 0.1, 'out').build();
  }
}
function sitDownFloor(b: Builder, rig: StateRig, sit = key(rig, 'sitFloor')) {
  b.to(key(rig, null, { pose: { gazeY: 0.4, headTilt: 0.05, armL: 0.15, armR: 0.15 } }), 0.35);
  // Lower (controlled), seat contact with a small overshoot and squash, then settle.
  b.to({ ...sit, pose: addPose(sit.pose, { bob: 8 / 600, squash: 0.25 }) }, 0.7, 'inOut');
  b.to({ ...sit, pose: addPose(sit.pose, { squash: 0.45 }) }, 0.06, 'out');
  b.to(sit, 0.49, 'out');
}
function lieDown(b: Builder, rig: StateRig, lie: KeyPose) {
  b.to(key(rig, 'kneelProp', { rot: -18 }), 0.6);
  b.to({ ...lie, sleep: 0.6 }, 1.2, 'inOut');
  b.to({ ...lie, pose: addPose(lie.pose, { squash: 0.3, hairSquash: 0.05 }), sleep: 0.8 }, 0.1);
  b.to(lie, 0.5, 'out');
}

/** From the state back to standing at the spot's approach point. */
export function exitPlan(
  state: BodyStateId,
  spot: Spot | null,
  context: PlanContext,
  wake: 'urgent' | 'normal' | undefined,
): Timeline {
  const { rig, gap } = context;
  const held = heldKey(state, spot, context);
  const b = new Builder(held);
  if (context.reducedMotion) return b.to(restKey, 0.5).build();
  const ledge = spot?.surface === 'ledge';
  switch (state) {
    case 'stand':
      return b.build();
    case 'doze': {
      const seated = heldKey('sit', spot, context);
      if (wake === 'urgent')
        b.to({ ...seated, pose: addPose(seated.pose, { browL: -0.6, browR: -0.6 }) }, 0.15, 'out');
      else b.to(seated, 0.8);
      if (ledge) dropFromLedge(b, rig, gap, seated);
      else standFromFloor(b, rig, wake === 'urgent', seated);
      return b.build();
    }
    case 'sit':
      if (ledge) dropFromLedge(b, rig, gap, held);
      else standFromFloor(b, rig, false, held);
      return b.build();
    case 'nap':
      wakeFromLie(b, rig, wake ?? 'normal', true);
      return b.build();
    case 'peek':
      b.to(key(rig, null, { pose: { headTilt: 0.1, gazeY: 0.2 } }), 0.25);
      return b.to(restKey, 0.25).build();
    case 'perch':
      b.to(key(rig, 'crouch', { lift: gap }), 0.25);
      b.jump(restKey, gap + 0.08, rig.keys.airTuck);
      return b.land(restKey, gap + 0.08).build();
    case 'lean':
      b.to({ ...held, rot: held.rot - 2, pose: addPose(held.pose, { armL: 0.25 }) }, 0.3);
      return b.to(restKey, 0.5, 'out').build();
  }
}
function standFromFloor(b: Builder, rig: StateRig, fast: boolean, sit = key(rig, 'sitFloor')) {
  const k = fast ? 0.6 : 1;
  // Flexion-momentum: lean forward and load, then rise past standing a touch, then settle.
  b.to(
    { ...sit, pose: addPose(sit.pose, { lean: 0.18, bob: 5 / 600, armL: 0.3, armR: 0.3 }) },
    0.3 * k,
  );
  b.to(key(rig, null, { pose: { squash: -0.3, lean: 0.05 } }), 0.6 * k, 'out');
  b.to(restKey, 0.4 * k, 'out');
}
function dropFromLedge(
  b: Builder,
  rig: StateRig,
  gap: number,
  seated = key(rig, 'sitLedge', { lift: gap - rig.seatHeight }),
) {
  const pushed = {
    ...seated,
    lift: seated.lift + 0.02,
    pose: addPose(seated.pose, { armL: 0.3, armR: 0.3 }),
  };
  b.to(pushed, 0.25);
  const apex = pushed.lift + 0.05;
  b.jump(key(rig, null, { pose: { squash: -0.2 } }), apex, { footLY: 0.02, footRY: 0.02 });
  b.land(restKey, apex);
}
function wakeFromLie(b: Builder, rig: StateRig, wake: 'urgent' | 'normal', stand: boolean) {
  const lie = b.current;
  if (wake === 'urgent') {
    b.to({ ...lie, sleep: 0, pose: addPose(lie.pose, { browL: -0.8, browR: -0.8 }) }, 0.12, 'out');
    b.to({ ...key(rig, 'kneelProp', { rot: -18 }) }, 0.45);
    b.to(key(rig, 'sitFloor'), 0.3);
    if (stand) standFromFloor(b, rig, true);
    return;
  }
  // Eyes flutter, push up with effort (pause at the prop), sit, stretch and yawn, then stand.
  b.to({ ...lie, sleep: 0.7 }, 0.4);
  b.to({ ...key(rig, 'kneelProp', { rot: -18 }), sleep: 0.3 }, 0.7);
  b.to(key(rig, 'kneelProp', { rot: -16 }), 0.2);
  const sit = key(rig, 'sitFloor');
  b.to(sit, 0.5);
  b.to({ ...sit, pose: addPose(sit.pose, { headTilt: 0.12 }) }, 0.3);
  const stretch = { ...sit, pose: { ...sit.pose, ...rig.keys.stretch, bob: sit.pose.bob ?? 0 } };
  b.to(stretch, 0.5);
  b.to({ ...stretch, pose: addPose(stretch.pose, { squash: -0.05 }) }, 0.6, 'linear');
  b.to(sit, 0.6);
  if (stand) standFromFloor(b, rig, false);
}

/** Direct transitions at the same spot (sit -> doze, doze -> nap, nap -> sit...), or null. */
export function shortcutPlan(
  from: BodyStateId,
  to: BodyStateId,
  spot: Spot | null,
  context: PlanContext,
  wake: 'urgent' | 'normal' | undefined,
): Timeline | null {
  const { rig } = context;
  const start = heldKey(from, spot, context);
  const end = heldKey(to, spot, context);
  const b = new Builder(start);
  const floor = spot?.surface !== 'ledge';
  if (context.reducedMotion) return b.to(end, 0.5).build();
  if (from === 'sit' && to === 'doze') return b.to(end, 2.0).build();
  if (from === 'doze' && to === 'sit')
    return b.to(end, wake === 'urgent' ? 0.15 : 0.8, wake === 'urgent' ? 'out' : 'inOut').build();
  if ((from === 'sit' || from === 'doze') && to === 'nap' && floor) {
    if (from === 'doze') b.to(key(rig, 'sitFloor'), 0.5);
    lieDown(b, rig, end);
    return b.build();
  }
  if (from === 'nap' && (to === 'sit' || to === 'doze') && floor) {
    wakeFromLie(b, rig, wake ?? 'normal', false);
    if (to === 'doze') b.to(end, 2.0);
    return b.build();
  }
  return null;
}
