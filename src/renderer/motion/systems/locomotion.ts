// Motion-driven travel: the character walks/hops to a target instead of gliding like a sticker.
//
// - Steering: Reynolds "arrive" (slowing radius) with velocity on an exact critical spring.
// - Stride wheel (Rosen, GDC 2014): the gait phase advances with distance travelled, so the
//   cycle rate always matches speed and freezes when stationary.
// - Feet (rigs with foot IK targets): a planted foot is locked to its ground position, so it
//   cannot slide by construction; the swing foot arcs to a landing point ahead of the body.
// - Hops: horizontal travel is concentrated in the flight phase; contact frames barely move.
// - Lean = gain * atan2(a, g) into acceleration, anticipation before moving off, turn with a
//   squash-through-narrow before travelling the other way, feet-together settle on arrival.
// - Reduced motion: fade out, relocate, fade in (no travel across the stage).
// Units: x in stage units (fraction of canvas height, so x_norm * aspect); body sizes in body
// heights (BH, the rendered character height).
import { clamp01, smootherstep } from '../core/curves';
import { range, rngFor, type Rng } from '../core/random';
import { CriticalSpring, SecondOrder } from '../core/spring';
import type { MotionProfile } from '../profile';
import type { Pose, Stage } from '../types';

export type Gait = 'step' | 'amble' | 'scoot' | 'tired' | 'hop';

export interface GaitDef {
  /** Step (or hop) length in body heights. */
  stride: number;
  /** Steps (or hops) per second at full speed. */
  cadence: number;
  /** Swing-foot lift, BH. */
  lift: number;
  /** Vertical body bob per step, BH (+ = down). */
  bob: number;
  /** Hop apex as a fraction of BH (0 = walking gait). */
  hop: number;
  /** Constant forward lean while travelling, radians (negative = held back). */
  lean: number;
  armSwing: number;
  /** Landing squash for hops (placement scale). */
  land: number;
  /** Head posture while travelling. */
  gazeY: number;
}

// Chibi legs are short: the rig's foot IK reaches roughly +-0.08 BH, so planted steps are small
// and quick. Long trips use hops (flight phase), as small characters do.
export const gaits: Readonly<Record<Gait, GaitDef>> = {
  step: {
    stride: 0.12,
    cadence: 2.8,
    lift: 0.035,
    bob: 0.01,
    hop: 0,
    lean: 0.035,
    armSwing: 0.2,
    land: 0,
    gazeY: 0,
  },
  amble: {
    stride: 0.11,
    cadence: 2.2,
    lift: 0.03,
    bob: 0.012,
    hop: 0,
    lean: 0.015,
    armSwing: 0.12,
    land: 0,
    gazeY: 0.05,
  },
  scoot: {
    stride: 0.07,
    cadence: 2.6,
    lift: 0.016,
    bob: 0.005,
    hop: 0,
    lean: -0.012,
    armSwing: 0.04,
    land: 0,
    gazeY: 0.25,
  },
  tired: {
    stride: 0.09,
    cadence: 1.7,
    lift: 0.02,
    bob: 0.02,
    hop: 0,
    lean: 0.075,
    armSwing: 0.05,
    land: 0,
    gazeY: 0.35,
  },
  hop: {
    stride: 0.3,
    cadence: 2.2,
    lift: 0.025,
    bob: 0,
    hop: 0.12,
    lean: 0.05,
    armSwing: 0.25,
    land: 0.2,
    gazeY: -0.05,
  },
};

export interface LocomotionCaps {
  /** Rig has foot IK targets (planted steps); otherwise walking falls back to hops/step-bob. */
  feet: boolean;
}

export function chooseGait(distanceBH: number, profile: MotionProfile, caps: LocomotionCaps): Gait {
  if (!caps.feet) return 'hop';
  if (distanceBH > 2.2) return profile.gait === 'scoot' && distanceBH < 3.5 ? 'scoot' : 'hop';
  if (distanceBH < 0.25) return profile.gait === 'scoot' ? 'scoot' : 'step';
  return profile.gait === 'hop' ? (distanceBH > 1 ? 'hop' : 'step') : profile.gait;
}

export interface MoveCommand {
  /** Target x as a fraction of canvas width. */
  x: number;
  /** Target ground line as a fraction of canvas height (default: current). */
  y?: number;
  at: number;
  gait?: Gait;
  /** Speed multiplier (default 1). */
  speed?: number;
  /** Allow targets outside the safe bounds (walking on/off stage). */
  unbounded?: boolean;
  /** Facing on arrival (default: keep travel direction). */
  faceOnArrival?: 1 | -1;
}

export interface LocomotionFrame {
  x: number;
  y: number;
  /** Hop height as a fraction of canvas height (add above y). */
  lift: number;
  facing: number;
  opacity: number;
  scaleX: number;
  scaleY: number;
  pose: Partial<Pose>;
  moving: boolean;
  gait: Gait | null;
  state: State;
}

type State = 'idle' | 'turning' | 'anticipate' | 'moving' | 'settling' | 'fadeOut' | 'fadeIn';

interface Foot {
  /** Ground x in stage units while planted. */
  world: number;
  /** Character-space offset (BH) at lift-off, for the swing arc. */
  from: number;
  planted: boolean;
}

const G = 9.8; // body heights / s^2 (a chibi is roughly a metre tall)
/** Facing flip duration; the swap happens at the narrowest point (|facing| ~ 0). */
const TURN = 0.16;
/** Crouch/squash anticipation before the flip, and settle after it. */
const TURN_LEAD = 0.1;
const TURN_TAIL = 0.06;

export class Locomotion {
  private rng: Rng;
  private x = 0.5;
  private y = 0.9;
  private velocity = new CriticalSpring(0.15, 0);
  private lastVelocity = 0;
  private lean = new SecondOrder({ f: 1.6, zeta: 0.75, r: 0 }, 0);
  private facingFrom = 1;
  private facingTo = 1;
  private turnStart = -Infinity;
  private state: State = 'idle';
  private stateStart = 0;
  private command: MoveCommand | null = null;
  private target = { x: 0.5, y: 0.9 };
  private gait: Gait | null = null;
  private phase = 0;
  private feet: [Foot, Foot] = [
    { world: 0, from: 0, planted: true },
    { world: 0, from: 0, planted: true },
  ];
  private landing = 0;
  private settleFrom: [number, number] = [0, 0];
  private startY = 0.9;
  private totalDistance = 1;

  constructor(seed: number) {
    this.rng = rngFor(seed, 'locomotion');
  }

  /** Teleport (initial placement, reconnect, end of a reduced-motion move). */
  place(x: number, y: number) {
    this.x = x;
    this.y = y;
    this.target = { x, y };
    this.velocity.reset(0);
    this.state = 'idle';
    this.command = null;
    this.gait = null;
    this.feet = [
      { world: 0, from: 0, planted: true },
      { world: 0, from: 0, planted: true },
    ];
    this.needsReplant = true;
  }

  private needsReplant = true;

  moveTo(command: MoveCommand) {
    this.command = command;
  }

  /** Stop where it is (settles the current step). */
  stop(at: number) {
    this.command = null;
    if (this.state === 'moving' || this.state === 'anticipate' || this.state === 'turning') {
      this.target = { x: this.x, y: this.y };
      this.enter('settling', at);
    }
  }

  /** Turn in place to face a direction (e.g. back toward the camera after arriving). */
  turnTo(direction: 1 | -1, at: number) {
    if (direction === this.facingTo || this.state !== 'idle') return;
    this.beginTurn(direction, at, false);
  }

  private moveAfterTurn = false;

  private beginTurn(direction: number, now: number, thenMove: boolean) {
    this.facingFrom = this.facingTo;
    this.facingTo = direction;
    this.turnStart = now + TURN_LEAD;
    this.moveAfterTurn = thenMove;
    this.needsReplant = true;
    this.enter('turning', now);
  }

  /** Turn progress 0..1 while turning (0 otherwise), for renderers and debugging. */
  turnProgress(now: number) {
    return this.state === 'turning'
      ? clamp01((now - this.stateStart) / (TURN_LEAD + TURN + TURN_TAIL))
      : 0;
  }

  /** Pick a nearby point to amble to; deterministic per seed. */
  wander(at: number, stage: Stage) {
    const side = this.rng() < 0.5 ? -1 : 1;
    const distance = range(this.rng, 0.4, 1.4) * stage.bodyHeight;
    this.moveTo({ x: this.x + (side * distance) / stage.aspect, at });
  }

  get position() {
    return { x: this.x, y: this.y };
  }

  get busy() {
    return this.state !== 'idle' || this.command !== null;
  }

  private enter(state: State, now: number) {
    this.state = state;
    this.stateStart = now;
  }

  private facingAt(now: number) {
    const t = clamp01((now - this.turnStart) / TURN);
    return this.facingFrom + (this.facingTo - this.facingFrom) * smootherstep(t);
  }

  private bounds(stage: Stage) {
    const half = (stage.bodyHeight * 0.32) / stage.aspect;
    return { min: stage.margin + half, max: 1 - stage.margin - half };
  }

  update(
    dt: number,
    now: number,
    profile: MotionProfile,
    stage: Stage,
    caps: LocomotionCaps,
  ): LocomotionFrame {
    const bh = stage.bodyHeight;
    const toStage = (xNorm: number) => xNorm * stage.aspect;
    if (this.needsReplant) {
      for (const foot of this.feet) foot.world = toStage(this.x);
      this.needsReplant = false;
    }
    const pose: Partial<Pose> = {};
    let lift = 0,
      opacity = 1,
      scaleX = 1,
      scaleY = 1;

    // Accept a pending command.
    if (this.command && this.command.at <= now) {
      const command = this.command;
      this.command = null;
      const { min, max } = this.bounds(stage);
      this.target = {
        x: command.unbounded ? command.x : Math.min(max, Math.max(min, command.x)),
        y: command.y ?? this.y,
      };
      const distanceBH = Math.abs(toStage(this.target.x - this.x)) / bh;
      this.startY = this.y;
      this.totalDistance = Math.max(1e-6, Math.abs(this.target.x - this.x));
      if (distanceBH < 0.01 && Math.abs(this.target.y - this.y) < 0.002) {
        // Nothing to do.
      } else if (!profile.travel) {
        this.enter('fadeOut', now);
      } else {
        this.gait = command.gait ?? chooseGait(distanceBH, profile, caps);
        if (!caps.feet && this.gait !== 'hop') this.gait = 'hop';
        this.speedScale = command.speed ?? 1;
        const direction = Math.sign(this.target.x - this.x) || this.facingTo;
        // Reversing always plays a readable turn first, never a mid-stride flip.
        if (direction !== this.facingTo) this.beginTurn(direction, now, true);
        else if (this.state !== 'moving') this.enter('anticipate', now);
      }
    }

    const def = this.gait ? gaits[this.gait] : gaits.step;
    const tempo = Math.max(0.5, profile.tempo);
    const vmax = def.stride * def.cadence * bh * tempo * this.speedScale; // stage units / s
    const facing = this.facingAt(now);
    const forward = Math.sign(this.facingTo) || 1;
    let desired = 0;

    switch (this.state) {
      case 'turning': {
        // Crouch (anticipation), flip at the narrowest point with a squash, head and hair lag.
        const t = now - this.stateStart;
        const crouch = Math.sin(clamp01(t / (TURN_LEAD + TURN * 0.5)) * Math.PI);
        const narrow = 1 - Math.abs(facing);
        pose.bob = 0.007 * crouch;
        pose.squash = 0.35 * crouch;
        scaleY = 1 + 0.05 * narrow;
        pose.headTilt = -0.08 * this.facingTo * narrow;
        pose.hairSwing = 0.25 * this.facingTo * narrow;
        pose.gazeX = 0.5 * this.facingTo * clamp01((t - TURN_LEAD) / TURN);
        if (t >= TURN_LEAD + TURN + TURN_TAIL) {
          if (this.moveAfterTurn) this.enter('anticipate', now);
          else this.enter('idle', now);
        }
        break;
      }
      case 'anticipate': {
        const length = (0.16 * Math.max(0.3, profile.anticipation)) / tempo;
        const k = Math.sin(clamp01((now - this.stateStart) / length) * Math.PI);
        pose.lean = -0.05 * k * profile.amplitude;
        pose.bob = 0.008 * k;
        if (def.hop) {
          scaleY = 1 - 0.08 * k * profile.maxSquash;
          scaleX = 1 / scaleY;
        }
        if (now - this.stateStart >= length) this.enter('moving', now);
        break;
      }
      case 'moving': {
        const remaining = toStage(this.target.x - this.x);
        const slow = Math.max(0.25 * bh, vmax * 0.45);
        desired = Math.sign(remaining) * Math.min(vmax, (vmax * Math.abs(remaining)) / slow);
        if (
          Math.abs(remaining) < 0.002 * bh &&
          Math.abs(this.velocity.value) < 0.05 * vmax + 1e-4
        ) {
          this.enter('settling', now);
          this.settleFrom = [this.footOffset(0, toStage, bh), this.footOffset(1, toStage, bh)];
        }
        break;
      }
      case 'fadeOut':
        opacity = 1 - smootherstep((now - this.stateStart) / 0.18);
        if (now - this.stateStart >= 0.18) {
          this.x = this.target.x;
          this.y = this.target.y;
          this.needsReplant = true;
          this.enter('fadeIn', now);
          opacity = 0;
        }
        break;
      case 'fadeIn':
        opacity = smootherstep((now - this.stateStart) / 0.22);
        if (now - this.stateStart >= 0.22) this.enter('idle', now);
        break;
      default:
        break;
    }

    // Velocity and travel.
    const previousX = toStage(this.x);
    const v = this.velocity.update(dt, desired);
    const accel = dt > 0 ? (v - this.lastVelocity) / dt : 0;
    this.lastVelocity = v;
    const travelling = this.state === 'moving' || (this.state === 'settling' && Math.abs(v) > 1e-5);
    if (travelling && dt > 0) {
      const distance = Math.abs(v) * dt;
      if (def.hop) {
        // Spend the distance in the air: weight w(s) is 0 on the ground, normalised to mean 1.
        const s = this.phase % 1;
        const w = s < 0.15 || s > 0.85 ? 0 : 1 / 0.7;
        this.phase += distance / (def.stride * bh);
        this.x = (previousX + Math.sign(v) * distance * w) / stage.aspect;
      } else {
        this.phase += distance / (def.stride * bh);
        this.x = (previousX + v * dt) / stage.aspect;
      }
      const progress = clamp01(1 - Math.abs(this.target.x - this.x) / this.totalDistance);
      this.y = this.startY + (this.target.y - this.startY) * smootherstep(progress);
    }

    // Gait pose.
    const speedFraction = vmax > 0 ? Math.min(1, Math.abs(v) / vmax) : 0;
    const s = this.phase % 1;
    if (this.gait && (travelling || this.state === 'settling')) {
      if (def.hop) {
        const airborne = s >= 0.15 && s <= 0.85;
        const flight = airborne ? Math.sin(((s - 0.15) / 0.7) * Math.PI) : 0;
        const hopHeight =
          def.hop * Math.max(0.4, profile.amplitude) * Math.min(1, speedFraction * 1.6 + 0.2);
        lift = flight * hopHeight * bh;
        // Takeoff stretch, landing squash (volume preserving), scaled by the profile's limit.
        const contact = s < 0.15 ? 1 - s / 0.15 : s > 0.85 ? (s - 0.85) / 0.15 : 0;
        const stretch = airborne
          ? 0.08 * Math.sin(((s - 0.15) / 0.35) * Math.PI) * (s < 0.5 ? 1 : 0)
          : 0;
        const squash = def.land * contact * speedFraction;
        scaleY = Math.max(0.75, 1 - squash * profile.maxSquash + stretch * profile.maxSquash);
        scaleX = 1 / scaleY;
        pose.footLY = def.lift * flight;
        pose.footRY = def.lift * flight * 0.9;
        pose.armL = def.armSwing * flight;
        pose.armR = def.armSwing * flight;
        if (this.state === 'settling' && !airborne && s > 0.85) this.phase = Math.ceil(this.phase);
      } else if (caps.feet) {
        this.stepFeet(s, def, speedFraction, toStage, bh, forward, pose);
        // Lowest just after contact (~25% into the step), highest at passing (~75%).
        pose.bob = def.bob * (0.5 + 0.5 * Math.cos(2 * Math.PI * (s - 0.25))) * speedFraction;
        const swing = Math.sin(this.phase * Math.PI) * def.armSwing * speedFraction;
        pose.armL = swing;
        pose.armR = -swing;
        pose.squash = 0.15 * Math.cos(2 * Math.PI * (s - 0.25)) * speedFraction;
      }
      pose.gazeY = def.gazeY * speedFraction;
      pose.gazeX = 0.45 * forward * speedFraction;
      pose.hairSwing = -0.15 * forward * speedFraction;
    }

    if (this.state === 'settling') {
      // Feet together: swing each foot back under the body, one after the other.
      const t = now - this.stateStart;
      if (caps.feet && !def.hop) {
        for (const index of [0, 1] as const) {
          const k = clamp01((t - index * 0.16) / 0.16);
          const from = this.settleFrom[index];
          const offset = from * (1 - smootherstep(k));
          const key = index === 0 ? 'footL' : 'footR';
          pose[`${key}X`] = offset;
          pose[`${key}Y`] = Math.abs(from) > 0.004 ? 0.025 * Math.sin(k * Math.PI) : 0;
        }
      }
      if (t > 0.4 && Math.abs(v) < 1e-4) {
        for (const foot of this.feet) {
          foot.world = toStage(this.x);
          foot.from = 0;
          foot.planted = true;
        }
        this.gait = null;
        this.phase = 0;
        this.landing = 0;
        this.swingTarget = 0;
        this.enter('idle', now);
      }
    }

    // Lean into acceleration (character space: + = forward), clamped, with travel posture.
    const accelBH = (accel * forward) / bh;
    let leanTarget = 0.5 * Math.atan2(accelBH, G) + def.lean * speedFraction;
    leanTarget = Math.max(-0.16, Math.min(0.16, leanTarget)) * profile.amplitude;
    this.lean.set(profile.body);
    const leanValue = this.lean.update(dt, this.state === 'idle' ? 0 : leanTarget);
    pose.lean = (pose.lean ?? 0) + leanValue;
    pose.hairSwoop = -0.6 * leanValue;

    return {
      x: this.x,
      y: this.y,
      lift: lift,
      facing,
      opacity,
      scaleX,
      scaleY,
      pose,
      moving: this.state !== 'idle',
      gait: this.gait,
      state: this.state,
    };
  }

  private speedScale = 1;

  private footOffset(index: 0 | 1, toStage: (x: number) => number, bh: number) {
    const foot = this.feet[index];
    return ((foot.world - toStage(this.x)) * this.facingTo) / bh;
  }

  private stepFeet(
    s: number,
    def: GaitDef,
    speedFraction: number,
    toStage: (x: number) => number,
    bh: number,
    forward: number,
    pose: Partial<Pose>,
  ) {
    const step = Math.floor(this.phase);
    const swingIndex = (step % 2) as 0 | 1;
    const stanceIndex = (1 - swingIndex) as 0 | 1;
    if (step !== this.landing) {
      // New step: the previous swing foot plants where it is; the other foot lifts off.
      const landed = this.feet[stanceIndex];
      landed.world = toStage(this.x) + forward * this.swingTarget * bh;
      landed.planted = true;
      const lifting = this.feet[swingIndex];
      lifting.from = this.footOffset(swingIndex, toStage, bh);
      lifting.planted = false;
      this.landing = step;
    }
    const swing = this.feet[swingIndex];
    // Stance foot is locked to the ground: its offset is whatever keeps its world x fixed.
    const stanceOffset = this.footOffset(stanceIndex, toStage, bh);
    // Swing foot arcs from lift-off to half a stride ahead, shortened at low speed.
    const ahead = (def.stride / 2) * Math.max(0.35, speedFraction);
    const swingOffset = swing.from + (ahead - swing.from) * smootherstep(s);
    const swingLift = def.lift * Math.sin(Math.PI * s) * Math.max(0.4, speedFraction);
    this.swingTarget = swingOffset;
    const left = swingIndex === 0 ? { x: swingOffset, y: swingLift } : { x: stanceOffset, y: 0 };
    const right = swingIndex === 1 ? { x: swingOffset, y: swingLift } : { x: stanceOffset, y: 0 };
    pose.footLX = left.x;
    pose.footLY = left.y;
    pose.footRX = right.x;
    pose.footRY = right.y;
  }

  private swingTarget = 0;
}
