// HOW an expression moves. The expression/cue system decides WHAT and WHEN and calls play()/
// release(); this module turns an id + intensity into a time-shaped pose:
//   latency -> anticipation (counter-move) -> attack -> overshoot -> settle -> moving hold -> release.
// Every value is a pure function of time since the cue, so two renderers sharing the cue's start
// time agree, and nothing is ever a frozen frame (holds drift slightly: "moving holds").
// Authored clips play forward in real time (never scrubbed to a fixed frame) and fade with the
// envelope.
import {
  clamp01,
  reactionCurve,
  reactionLength,
  smootherstep,
  type ReactionShape,
} from '../core/curves';
import { fbm1 } from '../core/noise';
import type { MotionProfile } from '../profile';
import type { Channel, ClipRequest, Pose } from '../types';

type Groups = NonNullable<ClipRequest['owns']>;

export interface ExpressionDef {
  /** Timing at tempo 1 (seconds). overshoot/dip come from the profile. */
  timing: Omit<ReactionShape, 'overshoot' | 'dip'>;
  /** Channel offsets at intensity 1. */
  pose: Partial<Pose>;
  /** Extra time-varying motion (nods, bounces, shakes); t = seconds since the attack began. */
  motion?: (t: number, env: number, profile: MotionProfile) => Partial<Pose>;
  /** Authored clip played in real time from the attack, mixed by the envelope. */
  clip?: {
    role: string;
    rate?: number;
    loop?: boolean;
    owns: Groups;
    mix?: number;
    /** Play up to `from`, then ping-pong between from and to (seconds) instead of freezing. */
    pingPong?: [number, number];
  };
  /** Channels that recover first on release (e.g. brows before the head). */
  leadRelease?: readonly Channel[];
  /** Gaze override (eyes go here; weight blends against the gaze system). */
  gaze?: { x: number; y: number; weight: number };
  /** Lower blink rate while active (attentive listening). */
  attentive?: boolean;
}

const nod = (t: number, count: number, rate: number) =>
  t < count / rate ? Math.sin(t * rate * Math.PI * 2) * (1 - t / (count / rate)) : 0;

/** Smooth 0..1..0 bump starting at `start` lasting `length` seconds. */
function bumpWindow(t: number, start: number, length: number) {
  const x = (t - start) / length;
  return x <= 0 || x >= 1 ? 0 : Math.sin(x * Math.PI) ** 2;
}

/** A quick nervous blink (~0.18 s). */
function blinkPulse(t: number) {
  return bumpWindow(t, 0, 0.18);
}

/** A slow, deliberate blink (~0.45 s), for an unimpressed look. */
function slowBlink(t: number) {
  if (t <= 0 || t >= 0.45) return 0;
  return t < 0.12 ? smootherstep(t / 0.12) : 1 - smootherstep((t - 0.2) / 0.25);
}

export interface NodPlan {
  count: number;
  period: number;
  depth: number;
}

export function nodPlan(profile: MotionProfile): NodPlan {
  // Playful / high energy: quicker, three nods. Cozy: slower and soft. Shy: small.
  return {
    count: profile.tempo > 1.05 ? 3 : 2,
    period: 0.5 / Math.max(0.6, profile.tempo),
    depth: Math.min(1.2, 0.55 + 0.5 * profile.amplitude),
  };
}

/** Head pitch for a nod sequence (+ = down): fast drop, slower lift, decaying, tiny overshoot. */
export function nodCurve(t: number, plan: NodPlan) {
  if (t <= 0) return 0;
  const total = plan.count * plan.period;
  if (t < total) {
    const k = Math.floor(t / plan.period);
    const p = (t - k * plan.period) / plan.period;
    const decay = Math.pow(0.6, k);
    const value =
      p < 0.4 ? Math.sin((p / 0.4) * Math.PI) : -0.35 * Math.sin(((p - 0.4) / 0.6) * Math.PI);
    return value * decay;
  }
  const x = t - total;
  return x < 0.35 ? -0.08 * Math.sin((x / 0.35) * Math.PI) : 0;
}

export const expressionLibrary: Readonly<Record<string, ExpressionDef>> = {
  listening: {
    timing: { anticipation: 0.08, attack: 0.35, settle: 0.3, hold: 3, release: 0.5 },
    pose: { headTilt: 0.1, browL: -0.3, browR: -0.25, lean: 0.03, smile: 0.2, bob: 0.003 },
    motion: (t, env) => ({ gazeY: 0.08 * nod(t % 2.6, 1, 1.6) * env }),
    gaze: { x: 0, y: 0, weight: 0.8 },
    attentive: true,
  },
  // "Really?": lean back, then head tilt with one brow up and one down, narrowed lids, a flat
  // side-shifted mouth and a side-eye at the target. Living hold: noise head drift, slow brow
  // twitch, one slow blink, weight onto one hip with hands-on-hips played (ping-pong), and spicy
  // adds a small "aiit" head shake. Brows recover first, then the head.
  skeptical: {
    timing: { anticipation: 0.22, attack: 0.3, settle: 0.35, hold: 2.3, release: 0.6 },
    pose: {
      browL: -1,
      browR: 0.6,
      squintL: 0.25,
      squintR: 0.55,
      mouthX: 0.45,
      smile: -0.3,
      headTilt: -0.11,
      lean: -0.04,
    },
    leadRelease: ['browL', 'browR', 'squintL', 'squintR'],
    motion: (t, env, profile) => {
      const hip = smootherstep((t - 0.7) / 0.6) * env;
      const spicy = profile.head.r <= -0.5 ? 1 : 0;
      const shake = spicy * Math.sin((t - 1.3) * 16) * bumpWindow(t, 1.3, 0.45);
      return {
        headTilt: (0.025 * fbm1(31, t * 0.8) + 0.07 * shake) * env,
        headY: 0.004 * fbm1(32, t * 0.6) * env,
        browL: -0.12 * Math.max(0, Math.sin(t * 1.4)) ** 3 * env,
        blinkL: 0.9 * slowBlink(t - 1.25),
        blinkR: 0.9 * slowBlink(t - 1.27),
        shift: 0.012 * hip,
        lean: -0.02 * hip,
        bob: 0.003 * hip,
        gazeX: 0.06 * fbm1(33, t * 0.5) * env,
      };
    },
    clip: { role: 'hips', owns: ['arms'], mix: 0.75, pingPong: [0.9, 1.5] },
    gaze: { x: 0.5, y: 0.05, weight: 0.7 },
  },
  // "Oops": startle (squash, brows up, eyes wide), fast look away with a sheepish smile,
  // shoulders up, lean away, darting glances back, a nervous blink pair, fidgety sway.
  caught: {
    timing: { anticipation: 0.05, attack: 0.16, settle: 0.3, hold: 2.4, release: 0.6 },
    pose: {
      browL: -0.7,
      browR: -0.55,
      smile: 0.5,
      mouthX: -0.3,
      lean: -0.05,
      headTilt: -0.12,
      armL: -0.14,
      armR: -0.14,
    },
    motion: (t, env) => {
      const startle = bumpWindow(t, 0, 0.32);
      const glance = bumpWindow(t, 0.95, 0.3) + 0.8 * bumpWindow(t, 1.8, 0.26);
      return {
        squash: 0.7 * startle - 0.15 * glance,
        browL: -0.4 * startle,
        browR: -0.4 * startle,
        bob: 0.006 * startle,
        gazeX: 1.25 * glance * env,
        gazeY: 0.4 * glance * env,
        smile: -0.25 * glance,
        blinkL: blinkPulse(t - 0.5) + blinkPulse(t - 0.72),
        blinkR: blinkPulse(t - 0.51) + blinkPulse(t - 0.73),
        shift: 0.006 * Math.sin(t * 2.4) * env,
        headTilt: 0.035 * Math.sin(t * 1.9 + 0.5) * env,
        armL: -0.05 * Math.sin(t * 2.4) * env,
        armR: 0.05 * Math.sin(t * 2.4) * env,
      };
    },
    gaze: { x: -0.6, y: -0.35, weight: 0.9 },
  },
  // Nod: 2-3 real head nods (the face drops then lifts so the head reads as pitching), head node
  // in sync, upper body following ~70 ms later, lids half-closing on the downbeat, brows lifting on
  // the upbeat, squash on each down, hair follow-through (composer spring). First nod largest,
  // then decaying, settling with a tiny overshoot. Count/depth/tempo from personality and energy.
  approve: {
    timing: { anticipation: 0.08, attack: 0.18, settle: 0.2, hold: 1.5, release: 0.5 },
    pose: { browL: -0.25, browR: -0.25, smile: 0.4, squintL: 0.15, squintR: 0.15 },
    motion: (t, env, profile) => {
      const plan = nodPlan(profile);
      const d = nodCurve(t - 0.28, plan) * env; // after the attack lands
      const late = nodCurve(t - 0.35, plan) * env;
      const down = Math.max(0, d);
      const up = Math.max(0, -d);
      return {
        gazeY: 0.95 * d * plan.depth,
        headY: 0.016 * d * plan.depth,
        headTilt: 0.025 * d * plan.depth,
        lean: 0.035 * late * plan.depth,
        bob: 0.004 * late * plan.depth,
        squintL: 0.45 * down,
        squintR: 0.45 * down,
        browL: -0.45 * up,
        browR: -0.45 * up,
        squash: 0.3 * down * plan.depth,
      };
    },
  },
  celebrate: {
    timing: { anticipation: 0.15, attack: 0.2, settle: 0.25, hold: 1.6, release: 0.5 },
    pose: { smile: 0.9, squintL: 0.5, squintR: 0.5, browL: -0.5, browR: -0.5 },
    motion: (t, env) => {
      const hop = Math.abs(Math.sin(t * Math.PI * 2.4)) * env;
      return {
        bob: -0.02 * hop,
        squash: 0.6 * Math.cos(t * Math.PI * 4.8) * env,
        hairSwoop: 0.12 * Math.sin(t * Math.PI * 2.4) * env,
      };
    },
    clip: { role: 'celebrate', owns: ['arms'], mix: 0.85 },
  },
  wave: {
    timing: { anticipation: 0.12, attack: 0.25, settle: 0.25, hold: 1.6, release: 0.45 },
    pose: { headTilt: 0.08, smile: 0.6, squintL: 0.3, squintR: 0.3, lean: 0.02 },
    motion: (t, env) => ({ bob: 0.003 * Math.sin(t * 9) * env }),
    clip: { role: 'wave', owns: ['arms'], mix: 1 },
  },
  think: {
    timing: { anticipation: 0.1, attack: 0.45, settle: 0.3, hold: 2.5, release: 0.6 },
    pose: { browL: -0.5, browR: 0.2, mouthX: 0.4, smile: -0.1, headTilt: 0.1, lean: -0.01 },
    motion: (t, env) => ({ gazeX: 0.1 * Math.sin(t * 0.9) * env }),
    gaze: { x: 0.5, y: -0.5, weight: 0.85 },
  },
  happy: {
    timing: { anticipation: 0.1, attack: 0.25, settle: 0.3, hold: 1.8, release: 0.5 },
    pose: { smile: 0.9, squintL: 0.6, squintR: 0.6, browL: -0.3, browR: -0.3, headTilt: 0.06 },
    motion: (t, env) => ({ squash: 0.25 * Math.sin(t * 7) * Math.max(0, 1 - t / 1.2) * env }),
  },
  surprise: {
    timing: { anticipation: 0.05, attack: 0.12, settle: 0.35, hold: 1.2, release: 0.5 },
    pose: { browL: -1, browR: -1, smile: -0.8, squash: -0.6, lean: -0.05, armL: 0.25, armR: 0.25 },
  },
  bashful: {
    timing: { anticipation: 0.08, attack: 0.4, settle: 0.3, hold: 2, release: 0.6 },
    pose: {
      smile: 0.35,
      squintL: 0.4,
      squintR: 0.4,
      headTilt: 0.12,
      squash: 0.2,
      armL: -0.08,
      armR: -0.08,
    },
    gaze: { x: 0.4, y: 0.5, weight: 0.85 },
  },
  tired: {
    timing: { anticipation: 0, attack: 0.8, settle: 0.3, hold: 3, release: 0.8 },
    pose: {
      squintL: 0.7,
      squintR: 0.7,
      blinkL: 0.4,
      blinkR: 0.4,
      gazeY: 0.4,
      lean: 0.06,
      bob: 0.01,
      squash: 0.25,
      headTilt: 0.1,
      armL: -0.1,
      armR: -0.1,
    },
  },
  yawn: {
    timing: { anticipation: 0.2, attack: 0.7, settle: 0.2, hold: 1.1, release: 0.7 },
    pose: {
      smile: -1,
      mouthY: 1,
      squintL: 0.8,
      squintR: 0.8,
      blinkL: 0.6,
      blinkR: 0.6,
      armL: 0.45,
      armR: 0.45,
      squash: -0.4,
      lean: -0.04,
      headTilt: -0.06,
    },
  },
  dustOff: {
    timing: { anticipation: 0, attack: 0.25, settle: 0.1, hold: 1.1, release: 0.4 },
    pose: { gazeY: 0.55, browL: 0.2, browR: 0.2 },
    motion: (t, env) => {
      const shake = t > 0.25 && t < 0.95 ? Math.sin((t - 0.25) * 34) * (1 - (t - 0.25) / 0.7) : 0;
      const straighten = smootherstep((t - 1.0) / 0.35) * (1 - smootherstep((t - 1.5) / 0.3));
      return {
        shift: 0.006 * shake * env,
        hairSwoop: 0.15 * shake * env,
        hairSwing: 0.2 * shake * env,
        armL: 0.15 * Math.abs(shake) * env,
        armR: 0.15 * Math.abs(shake) * env,
        squash: -0.35 * straighten,
        gazeY: -0.5 * straighten,
      };
    },
  },
  determined: {
    timing: { anticipation: 0, attack: 0.2, settle: 0.2, hold: 1, release: 0.4 },
    pose: { browL: 0.6, browR: 0.6, smile: -0.2, squintL: 0.25, squintR: 0.25 },
  },
};

interface Instance {
  id: string;
  start: number;
  intensity: number;
  hold: number | undefined;
  releasedAt: number | null;
  releaseFrom: number;
}

export interface ExpressionOutput {
  pose: Partial<Pose>;
  clips: ClipRequest[];
  gaze: { x: number; y: number; weight: number } | null;
  attentive: boolean;
  active: string[];
}

function shapeFor(def: ExpressionDef, profile: MotionProfile, hold?: number): ReactionShape {
  const k = 1 / Math.max(0.3, profile.tempo);
  return {
    anticipation: def.timing.anticipation * k * Math.max(0.2, profile.anticipation),
    attack: def.timing.attack * k,
    settle: def.timing.settle * k,
    hold: hold ?? def.timing.hold * k,
    release: def.timing.release * k,
    overshoot: profile.overshoot,
    dip: 0.12 * profile.anticipation,
  };
}

export class ExpressionSystem {
  private instances: Instance[] = [];

  /** Start (or restart) an expression. `at` is the shared clock time of the cue. */
  play(id: string, { at, intensity = 1, hold }: { at: number; intensity?: number; hold?: number }) {
    if (!(id in expressionLibrary)) throw new Error('Unknown expression: ' + id);
    for (const instance of this.instances)
      if (instance.id === id && instance.releasedAt === null) this.releaseInstance(instance, at);
    this.instances.push({
      id,
      start: at,
      intensity: clamp01(intensity),
      hold,
      releasedAt: null,
      releaseFrom: 0,
    });
  }

  release(id: string, at: number) {
    for (const instance of this.instances)
      if (instance.id === id && instance.releasedAt === null) this.releaseInstance(instance, at);
  }

  /** Release everything (quiet, hide, a new manual cue that replaces the scene). */
  clear(at: number) {
    for (const instance of this.instances)
      if (instance.releasedAt === null) this.releaseInstance(instance, at);
  }

  /** Cut immediately (hide must be instant); use clear() for a graceful recovery. */
  cut() {
    this.instances = [];
  }

  private lastProfile: MotionProfile | null = null;

  private releaseInstance(instance: Instance, at: number) {
    const def = expressionLibrary[instance.id];
    instance.releaseFrom =
      def && this.lastProfile ? this.envelope(instance, def, this.lastProfile, at) : 1;
    instance.releasedAt = at;
  }

  private envelope(instance: Instance, def: ExpressionDef, profile: MotionProfile, now: number) {
    const shape = shapeFor(def, profile, instance.hold);
    const t = now - instance.start - profile.reactionLatency;
    if (instance.releasedAt !== null && now >= instance.releasedAt) {
      const r = (now - instance.releasedAt) / Math.max(0.05, shape.release);
      return instance.releaseFrom * (1 - smootherstep(r));
    }
    return reactionCurve(t, shape);
  }

  isBusy(now: number) {
    return this.instances.some((i) => i.releasedAt === null || now - i.releasedAt < 1);
  }

  evaluate(now: number, profile: MotionProfile): ExpressionOutput {
    this.lastProfile = profile;
    const pose: Partial<Pose> = {};
    const clips: ClipRequest[] = [];
    let gaze: ExpressionOutput['gaze'] = null;
    let attentive = false;
    const active: string[] = [];
    const add = (channel: Channel, value: number) => {
      pose[channel] = (pose[channel] ?? 0) + value;
    };
    this.instances = this.instances.filter((instance) => {
      const def = expressionLibrary[instance.id];
      if (!def) return false;
      const shape = shapeFor(def, profile, instance.hold);
      if (instance.releasedAt !== null) {
        if (now - instance.releasedAt > shape.release) return false;
      } else if (now - instance.start - profile.reactionLatency > reactionLength(shape))
        return false;
      return true;
    });
    for (const instance of this.instances) {
      const def = expressionLibrary[instance.id];
      if (!def) continue;
      const env = this.envelope(instance, def, profile, now);
      const t = Math.max(0, now - instance.start - profile.reactionLatency);
      const gain = instance.intensity * profile.amplitude;
      const weight = Math.abs(env);
      if (weight > 0.01) active.push(instance.id);
      const released = instance.releasedAt !== null && now >= instance.releasedAt;
      for (const [channel, value] of Object.entries(def.pose) as [Channel, number][]) {
        const lead = released && def.leadRelease?.includes(channel);
        add(channel, value * (lead ? env * env * env : env) * gain);
      }
      // Moving hold: a slow, small drift so a held pose never reads as a frozen frame.
      add('headTilt', 0.012 * Math.sin(t * 2.3 + instance.start) * clamp01(env) * gain);
      if (def.motion)
        for (const [channel, value] of Object.entries(def.motion(t, clamp01(env), profile)) as [
          Channel,
          number,
        ][])
          add(channel, value * gain);
      if (def.clip) {
        const rate = (def.clip.rate ?? 1) * Math.max(0.6, Math.min(1.4, profile.tempo));
        const anticipation = shapeFor(def, profile, instance.hold).anticipation;
        let clipTime = Math.max(0, t - anticipation) * rate;
        const range = def.clip.pingPong;
        if (range && clipTime > range[0]) {
          const span = Math.max(0.05, range[1] - range[0]);
          const cycle = (clipTime - range[0]) % (2 * span);
          clipTime = range[0] + (cycle < span ? cycle : 2 * span - cycle);
        }
        clips.push({
          role: def.clip.role,
          time: clipTime,
          mix: clamp01(env) * (def.clip.mix ?? 1) * Math.min(1, instance.intensity + 0.3),
          owns: def.clip.owns,
        });
      }
      if (def.gaze && weight > 0.01) {
        const w = def.gaze.weight * clamp01(env);
        if (!gaze || w > gaze.weight) gaze = { x: def.gaze.x, y: def.gaze.y, weight: w };
      }
      if (def.attentive && weight > 0.3) attentive = true;
    }
    return { pose, clips, gaze, attentive, active };
  }
}
