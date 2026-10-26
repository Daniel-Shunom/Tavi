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
import { airtime, apexFor, hopHeight, impactSpeed } from '../core/physics';
import { CriticalSpring, SecondOrder } from '../core/spring';
import {
  authoredGaitClips,
  gaitLibrary,
  resolveGait,
  type GaitBeat,
  type GaitId,
  type GaitSpec,
  type MoodId,
} from './gaits/library';
import type { MotionProfile } from '../profile';
import type { Pose, Stage } from '../types';

export type Gait = GaitId;
/** The gait library (kept under this name for existing imports). */
export const gaits = gaitLibrary;
export type GaitDef = GaitSpec;

/**
 * How a character shows a change of direction:
 *  cheat          front-facing chibi: never mirror; head/gaze, lean, weight and steps show the
 *                 direction (default).
 *  mirror-hidden  asymmetric character: mirror, but swap facing within a frame at the apex of a
 *                 tiny step-pivot hop so the flip is hidden in the action.
 *  authored       the rig has a three-quarter turnaround (turnHead/turnBody channels): never
 *                 mirror; the head turns toward travel ~100 ms before the body, both hold ~0.6
 *                 while walking and ease back to the camera on arrival.
 */
export type TurnStyle = 'cheat' | 'mirror-hidden' | 'authored';

export interface LocomotionCaps {
  /** Default 'cheat'. */
  turnStyle?: TurnStyle;
  /** Gaits the character provides authored cycles for (manifest tracks); others are procedural. */
  authored?: readonly GaitId[];
  /** Rig has foot IK targets (planted steps); otherwise travel uses flight cycles. */
  feet: boolean;
}

/**
 * Fallback gait when neither the cue nor the selection rules (gaits/select.ts) chose one.
 * Never an automatic hop: long trips speed the gait up instead.
 */
export function chooseGait(
  _distanceBH: number,
  profile: MotionProfile,
  caps: LocomotionCaps,
): Gait {
  if (!caps.feet) return 'hop';
  return profile.gait === 'amble' ? 'amble' : profile.gait === 'scoot' ? 'scurry' : 'walk';
}

export interface MoveCommand {
  /** Target x as a fraction of canvas width. */
  x: number;
  /** Target ground line as a fraction of canvas height (default: current). */
  y?: number;
  at: number;
  /** Gait id from the library (legacy cue names like 'stroll' are accepted). */
  gait?: string;
  /** Which gait beats to play: all (default), only the start beat, or none (choreography). */
  beats?: 'all' | 'start' | 'none';
  /** Mood override (face pose id); default: the gait's own mood. */
  mood?: MoodId;
  /** Speed multiplier (default 1; long trips speed up a little). */
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
  /** Authored gait cycle to play, phase-locked to ground speed (0..1 of one loop). */
  clip: { gait: GaitId; phase: number; mix: number } | null;
  /** Current gait/arrival beat name (diagnostics). */
  beat: string | null;
  /** Mood to perform while travelling (face pose id), with an envelope weight. */
  mood: { id: MoodId; weight: number; elapsed: number } | null;
}

type State =
  | 'idle'
  | 'turning'
  | 'anticipate'
  | 'moving'
  | 'pausing'
  | 'settling'
  | 'arriving'
  | 'fadeOut'
  | 'fadeIn';

interface Foot {
  /** Ground x in stage units while planted. */
  world: number;
  /** Character-space offset (BH) at lift-off, for the swing arc. */
  from: number;
  planted: boolean;
}

const G = 9.8; // body heights / s^2 (a chibi is roughly a metre tall)
/** Head snaps to the new side first (eyes lead the body by ~100 ms). */
const TURN_LEAD = 0.1;
/** Then a tiny step-pivot hop under the shared gravity; a mirror swap hides at its apex. */
const PIVOT_APEX = 0.025;
const TURN = airtime(PIVOT_APEX);
const TURN_TAIL = 0.06;
/** Authored turnaround: hold while walking, and the body's lag behind the head. */
const TURN_HOLD = 0.6;
const TURN_BODY_LAG = 0.1;

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

  /** Travel heading (1 right, -1 left), independent of the displayed facing. */
  get heading() {
    return this.facingTo;
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

  /** Current destination (including a command that is waiting for its start time). */
  get destination() {
    return { ...this.target };
  }

  get busy() {
    return (this.state !== 'idle' && this.state !== 'arriving') || this.command !== null;
  }

  private enter(state: State, now: number) {
    this.state = state;
    this.stateStart = now;
  }

  /** Displayed facing: swaps within one frame at the pivot-hop apex (mirror styles only). */
  private facingAt(now: number) {
    return now - this.turnStart >= TURN / 2 ? this.facingTo : this.facingFrom;
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
        let gait = resolveGait(command.gait) ?? chooseGait(distanceBH, profile, caps);
        if (!caps.feet && gaitLibrary[gait].cycle === 'step') gait = 'hop';
        this.gait = gait;
        this.mood = command.mood ?? null;
        this.beats = command.beats ?? 'all';
        this.moveStart = now;
        this.sincePause = 0;
        // Long trips: the same gait a little quicker (never an automatic hop).
        this.speedScale =
          command.speed ?? Math.min(1.35, Math.max(1, 1 + (distanceBH - 1.5) * 0.12));
        const direction = Math.sign(this.target.x - this.x) || this.facingTo;
        // Reversing always plays a readable turn first, never a mid-stride flip.
        if (direction !== this.facingTo) this.beginTurn(direction, now, true);
        else if (this.state !== 'moving') this.enter('anticipate', now);
      }
    }

    const tempo = Math.max(0.5, profile.tempo);
    const def = this.gait ? gaitLibrary[this.gait] : gaitLibrary.walk;
    const flying = def.cycle !== 'step';
    const contactEdge = (1 - def.flight) / 2;
    let beat: string | null = null;
    let beatMood: MoodId | undefined;
    let facingScale = 1;
    const runBeat = (b: GaitBeat, t: number) => {
      const length = b.duration / tempo;
      const k = clamp01(t / length);
      Object.assign(pose, b.pose(Math.min(t, length) * tempo, k));
      beat = b.name;
      beatMood = b.mood;
      if (b.facing) facingScale = b.facing(k);
      return t >= length;
    };
    // Authored cycle for this gait? Then play it phase-locked to distance (no foot slip) at a
    // little above its natural ground speed, with procedural lean/mood/beats on top.
    const authoredClip =
      this.gait && caps.authored?.includes(this.gait) ? authoredGaitClips[this.gait] : undefined;
    const authored =
      authoredClip?.stride && authoredClip.seconds
        ? { stride: authoredClip.stride, seconds: authoredClip.seconds }
        : null;
    const vmax = authored
      ? (authored.stride / authored.seconds) * 1.6 * bh * tempo * this.speedScale
      : def.stride * def.cadence * bh * tempo * this.speedScale; // stage units / s
    const style = caps.turnStyle ?? 'cheat';
    // Only mirror-hidden characters are ever mirrored; cheat and authored stay front-facing.
    const cheat = style !== 'mirror-hidden';
    const facing = cheat ? 1 : this.facingAt(now);
    const forward = Math.sign(this.facingTo) || 1;
    let desired = 0;

    switch (this.state) {
      case 'turning': {
        // Head-led turn: eyes and head snap to the new side, then a tiny step-pivot hop of the
        // feet (no body rotation, no squeeze), hair lagging. Forward coords: + = new heading.
        const t = now - this.stateStart;
        const snap = smootherstep(t / TURN_LEAD);
        pose.gazeX = 0.75 * snap;
        pose.headTilt = 0.07 * snap;
        pose.hairSwing = -0.2 * snap;
        const hop = t - TURN_LEAD;
        if (hop > 0 && hop < TURN) {
          lift = hopHeight(hop, TURN) * bh;
          pose.footLY = 0.015;
          pose.footRY = 0.015;
          pose.lean = 0.03;
        } else if (hop >= TURN) {
          const land = 1 - clamp01((hop - TURN) / TURN_TAIL);
          pose.bob = 0.006 * land;
          pose.squash = 0.25 * land;
        }
        if (t >= TURN_LEAD + TURN + TURN_TAIL) {
          this.needsReplant = true;
          if (this.moveAfterTurn) this.enter('anticipate', now);
          else this.enter('idle', now);
        }
        break;
      }
      case 'anticipate': {
        if (def.start && this.beats !== 'none') {
          if (runBeat(def.start, now - this.stateStart)) this.enter('moving', now);
          break;
        }
        const length = (0.16 * Math.max(0.3, profile.anticipation)) / tempo;
        const k = Math.sin(clamp01((now - this.stateStart) / length) * Math.PI);
        pose.lean = -0.05 * k * profile.amplitude;
        pose.bob = 0.008 * k;
        if (flying) {
          scaleY = 1 - 0.08 * k * profile.maxSquash;
          scaleX = 1 / scaleY;
        }
        if (now - this.stateStart >= length) this.enter('moving', now);
        break;
      }
      case 'pausing': {
        const pause = def.pause;
        this.holdFeet(toStage, bh, pose);
        if (!pause || runBeat(pause.beat, now - this.stateStart)) {
          this.sincePause = 0;
          this.enter('moving', now);
        }
        break;
      }
      case 'arriving': {
        if (!def.stop || runBeat(def.stop, now - this.stateStart)) this.finishArrival(now, toStage);
        break;
      }
      case 'moving': {
        const remaining = toStage(this.target.x - this.x);
        const slow = Math.max(0.25 * bh, vmax * 0.45);
        // Arrive with a minimum approach speed (no long exponential creep at the end).
        desired =
          Math.sign(remaining) *
          Math.max(0.25 * vmax, Math.min(vmax, (vmax * Math.abs(remaining)) / slow));
        // Mid-route stop-and-sigh (trudge) on long trips, at a step boundary with feet planted.
        if (
          def.pause &&
          this.beats === 'all' &&
          !flying &&
          this.sincePause > def.pause.every * bh &&
          Math.abs(remaining) > 0.8 * bh
        ) {
          this.plantFeet(toStage, bh);
          this.enter('pausing', now);
          this.holdFeet(toStage, bh, pose);
          desired = 0;
        }
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
      this.sincePause += distance;
      if (authored)
        this.authoredPhase +=
          (distance / (authored.stride * bh)) * (style === 'authored' ? Math.sign(v) : 1);
      if (flying && !authored) {
        // Spend the distance in the air: weight w(s) is 0 on the ground, normalised to mean 1.
        const s = this.phase % 1;
        const w = s < contactEdge || s > 1 - contactEdge ? 0 : 1 / def.flight;
        this.phase += distance / (def.stride * bh);
        this.x = (previousX + Math.sign(v) * distance * w) / stage.aspect;
      } else {
        this.phase += distance / (def.stride * bh);
        this.x = (previousX + v * dt) / stage.aspect;
      }
      // Reached (or passed) the target this frame: stop exactly on it and settle the feet.
      const left = toStage(this.target.x - this.x);
      if (
        this.state === 'moving' &&
        Math.abs(v) > 1e-6 &&
        (Math.abs(left) < 1e-6 || Math.sign(left) !== Math.sign(v))
      ) {
        this.x = this.target.x;
        this.velocity.reset(0);
        this.enter('settling', now);
        this.settleFrom = [this.lastFeet[0], this.lastFeet[1]];
      }
      const progress = clamp01(1 - Math.abs(this.target.x - this.x) / this.totalDistance);
      this.y = this.startY + (this.target.y - this.startY) * smootherstep(progress);
    }

    // Gait pose.
    const speedFraction = vmax > 0 ? Math.min(1, Math.abs(v) / vmax) : 0;
    const s = this.phase % 1;
    if (this.gait && (travelling || this.state === 'settling')) {
      if (authored) {
        // The clip keys feet, hips, torso, arms and head; add only crouch and posture here.
        pose.bob = def.crouch * this.travelWeight * 0;
      } else if (flying) {
        const airborne = s >= contactEdge && s <= 1 - contactEdge;
        const x = (s - contactEdge) / def.flight;
        const flight = airborne ? 4 * x * (1 - x) : 0;
        // Ballistic under the shared gravity: the apex follows from the time spent in the air at
        // the current speed (capped by the gait's height and personality).
        const cycleTime = (def.stride * bh) / Math.max(1e-4, Math.abs(v));
        const apex = Math.min(
          def.apex * Math.max(0.4, profile.amplitude),
          apexFor(def.flight * cycleTime),
        );
        lift = flight * apex * bh;
        // Takeoff stretch, landing squash in proportion to the impact speed (sqrt(2 g h)).
        const contact =
          s < contactEdge
            ? 1 - s / contactEdge
            : s > 1 - contactEdge
              ? (s - 1 + contactEdge) / contactEdge
              : 0;
        const stretch = airborne && x < 0.5 ? 0.08 * Math.sin(x * 2 * Math.PI) : 0;
        const impact = Math.min(1, impactSpeed(apex) / 1.5);
        const squash = def.land * contact * impact;
        scaleY = Math.max(0.75, 1 - squash * profile.maxSquash + stretch * profile.maxSquash);
        scaleX = 1 / scaleY;
        const lead = Math.floor(this.phase) % 2; // skip/run alternate the leading knee
        if (def.cycle === 'hop') {
          pose.footLY = def.lift * flight;
          pose.footRY = def.lift * flight * 0.9;
          pose.armL = def.armSwing * flight;
          pose.armR = def.armSwing * flight;
        } else {
          // Skip: the lead knee comes up high in the air; the double step is a quick tap of the
          // other foot during contact. Run: alternating smaller knee lifts.
          const high = def.lift * flight;
          const low = def.cycle === 'skip' ? 0.25 * high : 0.45 * high;
          const tap =
            def.cycle === 'skip' && s < contactEdge
              ? 0.02 * Math.sin((s / contactEdge) * Math.PI)
              : 0;
          pose.footLY = lead === 0 ? high : low + tap;
          pose.footRY = lead === 1 ? high : low + tap;
          const swing = def.armSwing * (0.3 + 0.7 * flight);
          pose.armL = def.armHang + (lead === 1 ? swing : 0.15 * swing);
          pose.armR = def.armHang + (lead === 0 ? swing : 0.15 * swing);
          pose.headTilt = def.headTilt * (lead === 0 ? 1 : -1) * flight;
        }
        if (this.state === 'settling' && !airborne && s > 1 - contactEdge)
          this.phase = Math.ceil(this.phase);
      } else if (caps.feet) {
        this.stepFeet(s, def, speedFraction, toStage, bh, forward, pose);
        // Hips: lowest just after contact (~25% into the step), highest at passing (~75%),
        // swaying over the stance foot; a constant crouch for sneaking.
        pose.bob =
          def.bob * (0.5 + 0.5 * Math.cos(2 * Math.PI * (s - 0.25))) * speedFraction +
          def.crouch * this.travelWeight;
        pose.shift = def.hipShift * Math.sin(this.phase * Math.PI) * speedFraction;
        const swing = Math.sin(this.phase * Math.PI) * def.armSwing * speedFraction;
        pose.armL = def.armHang * this.travelWeight + swing;
        pose.armR = def.armHang * this.travelWeight - swing;
        pose.headTilt = def.headTilt * Math.sin(this.phase * Math.PI) * speedFraction;
        // Heavy contact (stomp, trudge): squash right after each heel strike.
        const strike = Math.max(0, Math.cos(2 * Math.PI * Math.min(s, 0.5)));
        pose.squash =
          (0.15 * Math.cos(2 * Math.PI * (s - 0.25)) + def.contactSquash * strike) * speedFraction;
      }
      pose.gazeY = def.gazeY * Math.max(speedFraction, this.travelWeight);
      // Forward coordinates (+ = travel direction); see the cheat transform below.
      pose.gazeX = 0.45 * speedFraction;
      pose.hairSwing = -0.15 * speedFraction;
    }

    if (this.state === 'settling') {
      // Feet together: swing each foot back under the body, one after the other.
      const t = now - this.stateStart;
      if (caps.feet && !flying) {
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
        if (def.stop && this.beats === 'all') this.enter('arriving', now);
        else this.finishArrival(now, toStage);
      }
    }

    // Lean into acceleration (character space: + = forward), clamped, with travel posture.
    const accelBH = (accel * forward) / bh;
    let leanTarget = 0.5 * Math.atan2(accelBH, G) + def.lean * speedFraction;
    leanTarget = Math.max(-0.16, Math.min(0.16, leanTarget)) * profile.amplitude;
    this.lean.set(profile.body);
    const leanValue = this.lean.update(
      dt,
      this.state === 'idle' || this.state === 'arriving' ? 0 : leanTarget,
    );
    // Travel posture weight: in while setting off, held while travelling, out on arrival.
    const weightTarget =
      this.state === 'moving' || this.state === 'pausing' || this.state === 'anticipate' ? 1 : 0;
    this.travelWeight += (weightTarget - this.travelWeight) * (1 - Math.exp(-dt * 6));
    pose.lean = (pose.lean ?? 0) + leanValue;
    pose.hairSwoop = -0.6 * leanValue;

    this.lastFeet = [pose.footLX ?? 0, pose.footRX ?? 0];
    const clip =
      authored && this.gait && this.travelWeight > 0.01
        ? {
            gait: this.gait,
            phase: ((this.authoredPhase % 1) + 1) % 1,
            mix: this.travelWeight,
          }
        : null;
    if (this.state === 'idle') this.authoredPhase = 0;
    // Pose is in forward coordinates. Mirror styles let the renderer flip it; the cheat keeps the
    // body front-facing, so direction-signed channels point the way it travels instead.
    const out: Partial<Pose> = { ...pose };
    if (cheat && forward < 0)
      for (const key of [
        'gazeX',
        'headTilt',
        'lean',
        'shift',
        'hairSwing',
        'hairSwoop',
        'mouthX',
        'footLX',
        'footRX',
      ] as const)
        if (out[key] !== undefined) out[key] = -(out[key] ?? 0);
    if (style === 'authored') {
      // Three-quarter turnaround: head leads toward travel, the body follows ~100 ms later.
      const travelling3q =
        this.state !== 'idle' &&
        this.state !== 'arriving' &&
        this.state !== 'fadeOut' &&
        this.state !== 'fadeIn';
      const headTarget = travelling3q ? TURN_HOLD * forward : 0;
      if (headTarget !== this.turnHeadTarget) {
        this.turnHeadTarget = headTarget;
        this.turnHeadChangedAt = now;
      }
      if (now - this.turnHeadChangedAt >= TURN_BODY_LAG) this.turnBodyTarget = this.turnHeadTarget;
      out.turnHead = this.turnHead.update(dt, this.turnHeadTarget);
      out.turnBody = this.turnBody.update(dt, this.turnBodyTarget);
    }
    return {
      x: this.x,
      y: this.y,
      lift: lift,
      // Beat facing (e.g. the skip twirl) only applies to mirroring characters.
      facing: cheat ? 1 : facing * facingScale,
      opacity,
      scaleX,
      scaleY,
      pose: out,
      // The arrival beat is cosmetic and interruptible: report arrival as soon as feet settle.
      moving: this.state !== 'idle' && this.state !== 'arriving',
      gait: this.gait,
      state: this.state,
      beat,
      clip,
      mood: this.moodFrame(now, def, beatMood),
    };
  }

  private speedScale = 1;
  private turnHead = new CriticalSpring(0.06, 0);
  private turnBody = new CriticalSpring(0.1, 0);
  private turnHeadTarget = 0;
  private turnBodyTarget = 0;
  private turnHeadChangedAt = 0;
  private authoredPhase = 0;
  private beats: 'all' | 'start' | 'none' = 'all';
  private mood: MoodId | null = null;
  private moveStart = 0;
  private sincePause = 0;
  private travelWeight = 0;

  private moodFrame(now: number, def: GaitSpec, beatMood: MoodId | undefined) {
    if (
      this.state === 'idle' ||
      this.state === 'turning' ||
      this.state === 'fadeOut' ||
      this.state === 'fadeIn'
    )
      return null;
    const id = beatMood ?? this.mood ?? def.mood?.id;
    if (!id) return null;
    let weight = def.mood?.intensity ?? 0.7;
    if (this.state === 'arriving' && def.stop)
      weight *= 1 - smootherstep((now - this.stateStart) / (def.stop.duration * 1.2));
    if (this.state === 'anticipate') weight *= smootherstep((now - this.stateStart) / 0.3);
    return { id, weight, elapsed: now - this.moveStart };
  }

  private finishArrival(now: number, toStage: (x: number) => number) {
    for (const foot of this.feet) {
      foot.world = toStage(this.x);
      foot.from = 0;
      foot.planted = true;
    }
    this.gait = null;
    this.mood = null;
    this.phase = 0;
    this.landing = 0;
    this.swingTarget = 0;
    this.enter('idle', now);
  }

  /** Plant both feet exactly where they were last drawn (mid-route pause): continuous. */
  private plantFeet(toStage: (x: number) => number, bh: number) {
    const forward = Math.sign(this.facingTo) || 1;
    this.feet[0].world = toStage(this.x) + forward * this.lastFeet[0] * bh;
    this.feet[1].world = toStage(this.x) + forward * this.lastFeet[1] * bh;
    for (const foot of this.feet) foot.planted = true;
    const swingIndex = (Math.floor(this.phase) % 2) as 0 | 1;
    this.feet[swingIndex].from = this.lastFeet[swingIndex];
  }

  private lastFeet: [number, number] = [0, 0];

  /** Both feet planted at their ground positions (pausing). */
  private holdFeet(toStage: (x: number) => number, bh: number, pose: Partial<Pose>) {
    pose.footLX = this.footOffset(0, toStage, bh);
    pose.footRX = this.footOffset(1, toStage, bh);
    pose.footLY = 0;
    pose.footRY = 0;
  }

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
