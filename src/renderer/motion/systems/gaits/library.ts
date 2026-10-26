// Gait + mood library: HOW Tavi travels, as data. Each gait describes its cycle (foot timing,
// stride, lift, hip bob/shift, lean, arm swing, head and hair), speed, the mood it carries (an
// expression id from shared/expressions.ts, performed by the character's face poses), and short
// start / stop / mid-route beats. The locomotion controller interprets these; selection lives in
// select.ts and can be replaced without touching the gaits.
//
// Units: body heights (BH), seconds, radians. Pose channels follow motion/types.ts.
// Chibi legs reach only ~+-0.08 BH, so planted strides stay short; flight cycles (skip, run,
// hop) cover ground in the air under the shared gravity (core/physics.ts).
import { smootherstep } from '../../core/curves';
import type { Pose } from '../../types';

export const gaitIds = [
  'walk',
  'amble',
  'skip',
  'trudge',
  'scurry',
  'sneak',
  'stomp',
  'run',
  'hop',
] as const;
export type GaitId = (typeof gaitIds)[number];

/** Mood expression ids (shared/expressions.ts) a gait or cue may carry. */
export const moodIds = [
  'content',
  'excited',
  'sad',
  'annoyed',
  'sleepy',
  'worried',
  'pout',
  'frown',
  'bored',
  'determined',
  'focused',
  'grin',
] as const;
export type MoodId = (typeof moodIds)[number];

/** A short authored-in-code moment at the start/end of travel or mid-route. */
export interface GaitBeat {
  name: string;
  /** Seconds at tempo 1. */
  duration: number;
  /** Pose offsets over the beat (t seconds, k = 0..1). */
  pose: (t: number, k: number) => Partial<Pose>;
  /** Optional facing multiplier (e.g. a twirl passes through 0 twice). */
  facing?: (k: number) => number;
  /** Optional mood override for this beat (e.g. a groan before a trudge). */
  mood?: MoodId;
}

export type GaitCycle = 'step' | 'skip' | 'run' | 'hop';

export interface GaitSpec {
  id: GaitId;
  label: string;
  description: string;
  /** step: planted IK feet; skip/run/hop: flight phases under gravity. */
  cycle: GaitCycle;
  /** Step (or skip/hop) length, BH. */
  stride: number;
  /** Steps (or skips/hops) per second at full speed. */
  cadence: number;
  /** Swing-foot lift, BH (low = dragging feet). */
  lift: number;
  /** Hip drop per step, BH (+ down). */
  bob: number;
  /** Constant hip crouch while travelling, BH (sneak). */
  crouch: number;
  /** Hip sway toward the stance foot, BH. */
  hipShift: number;
  /** Travel posture lean (+ forward), radians. */
  lean: number;
  /** Arm swing amplitude and resting arm angle (radians, + out). */
  armSwing: number;
  armHang: number;
  /** Head posture while travelling. */
  gazeY: number;
  headTilt: number;
  /** Squash on each foot contact (stomp), channel units. */
  contactSquash: number;
  /** Max apex for flight cycles, BH; landing squash for flight cycles. */
  apex: number;
  land: number;
  /** Fraction of a flight cycle spent in the air. */
  flight: number;
  /** Mood carried while travelling (face pose id) and its intensity. */
  mood?: { id: MoodId; intensity: number };
  start?: GaitBeat;
  stop?: GaitBeat;
  /** Occasional stop-and-sigh during long trips (every `every` BH). */
  pause?: { every: number; beat: GaitBeat };
  /** Authored cycle handle a character may provide (manifest locomotion), else procedural. */
  authored?: string;
}

const win = (t: number, s: number, a: number, h: number, r: number) => {
  const x = t - s;
  if (x <= 0) return 0;
  if (x < a) return smootherstep(x / a);
  if (x < a + h) return 1;
  return 1 - smootherstep((x - a - h) / r);
};

const groanSigh: GaitBeat = {
  name: 'groan and sigh',
  duration: 1.1,
  mood: 'annoyed',
  pose: (t) => {
    // Eye-roll (look up and across), shoulders rise, then a heavy exhale and slump.
    const roll = win(t, 0, 0.15, 0.25, 0.2);
    const inhale = win(t, 0.1, 0.3, 0.15, 0.3);
    const slump = win(t, 0.55, 0.3, 0.4, 0.2);
    return {
      gazeY: -0.7 * roll + 0.4 * slump,
      gazeX: 0.5 * Math.sin(Math.min(1, t / 0.6) * Math.PI) * roll,
      armL: 0.15 * inhale - 0.08 * slump,
      armR: 0.15 * inhale - 0.08 * slump,
      squash: -0.35 * inhale + 0.35 * slump,
      bob: 0.012 * slump,
      squintL: 0.5 * slump,
      squintR: 0.5 * slump,
      headTilt: 0.06 * slump,
    };
  },
};

const slumpHmph: GaitBeat = {
  name: 'slump, hmph',
  duration: 1.0,
  mood: 'pout',
  pose: (t) => {
    const slump = win(t, 0, 0.25, 0.5, 0.25);
    const hmph = win(t, 0.35, 0.08, 0.25, 0.2);
    return {
      bob: 0.015 * slump,
      squash: 0.4 * slump,
      armL: -0.1 * slump,
      armR: -0.1 * slump,
      headTilt: 0.08 * slump - 0.05 * hmph,
      gazeX: -0.4 * hmph,
      browL: 0.5 * hmph,
      browR: 0.5 * hmph,
      squintL: 0.4 * slump,
      squintR: 0.4 * slump,
    };
  },
};

const trudgePause: GaitBeat = {
  name: 'stop and sigh',
  duration: 1.3,
  mood: 'sad',
  pose: (t) => {
    const inhale = win(t, 0, 0.4, 0.15, 0.3);
    const exhale = win(t, 0.55, 0.3, 0.3, 0.3);
    const look = win(t, 0.75, 0.15, 0.25, 0.2);
    return {
      squash: -0.3 * inhale + 0.35 * exhale,
      armL: 0.1 * inhale - 0.06 * exhale,
      armR: 0.1 * inhale - 0.06 * exhale,
      bob: 0.01 * exhale,
      // A glance back as if to complain.
      gazeX: -0.7 * look,
      headTilt: -0.06 * look,
    };
  },
};

const skipStart: GaitBeat = {
  name: 'little bounce',
  duration: 0.35,
  pose: (_t, k) => ({
    bob: 0.012 * Math.sin(k * Math.PI),
    squash: 0.4 * Math.sin(k * Math.PI),
    armL: 0.3 * k,
    armR: 0.3 * k,
  }),
};

const skipTwirl: GaitBeat = {
  name: 'twirl and bounce',
  duration: 0.75,
  facing: (k) => Math.cos(Math.min(1, k / 0.6) * Math.PI * 2),
  pose: (t) => {
    const bounce = win(t, 0.45, 0.08, 0.05, 0.2);
    return {
      armL: 0.5 * win(t, 0, 0.1, 0.3, 0.2),
      armR: 0.5 * win(t, 0, 0.1, 0.3, 0.2),
      squash: 0.45 * bounce,
      bob: 0.01 * bounce,
      smile: 0.6,
    };
  },
};

const stompStop: GaitBeat = {
  name: 'stomp and cross',
  duration: 0.6,
  pose: (t) => {
    const stomp = win(t, 0, 0.06, 0.08, 0.2);
    return {
      squash: 0.5 * stomp,
      bob: 0.012 * stomp,
      armL: -0.2,
      armR: -0.2,
      browL: 0.6,
      browR: 0.6,
    };
  },
};

const contentArrive: GaitBeat = {
  name: 'settle in',
  duration: 0.6,
  pose: (t) => {
    const breath = win(t, 0, 0.25, 0.1, 0.25);
    return {
      squash: -0.25 * breath,
      smile: 0.3 * breath,
      squintL: 0.2 * breath,
      squintR: 0.2 * breath,
    };
  },
};

const sneakLook: GaitBeat = {
  name: 'look both ways',
  duration: 0.7,
  pose: (t) => ({
    gazeX: 0.7 * Math.sin(Math.min(1, t / 0.6) * Math.PI * 2),
    bob: 0.02,
    armL: -0.15,
    armR: -0.15,
  }),
};

export const gaitLibrary: Readonly<Record<GaitId, GaitSpec>> = {
  walk: {
    id: 'walk',
    label: 'Walk',
    description: 'A neutral, light step.',
    cycle: 'step',
    stride: 0.12,
    cadence: 2.8,
    lift: 0.035,
    bob: 0.01,
    crouch: 0,
    hipShift: 0.004,
    lean: 0.035,
    armSwing: 0.2,
    armHang: 0,
    gazeY: 0,
    headTilt: 0,
    contactSquash: 0.1,
    apex: 0,
    land: 0,
    flight: 0,
  },
  amble: {
    id: 'amble',
    label: 'Amble',
    description: 'Cozy and relaxed, loose arms, a little sway.',
    cycle: 'step',
    stride: 0.11,
    cadence: 2.2,
    lift: 0.03,
    bob: 0.012,
    crouch: 0,
    hipShift: 0.007,
    lean: 0.015,
    armSwing: 0.13,
    armHang: 0,
    gazeY: 0.05,
    headTilt: 0.03,
    contactSquash: 0.08,
    apex: 0,
    land: 0,
    flight: 0,
    mood: { id: 'content', intensity: 0.5 },
    stop: contentArrive,
  },
  skip: {
    id: 'skip',
    label: 'Skip',
    description: 'Happy double-step hops, big arm swing, bouncy.',
    cycle: 'skip',
    stride: 0.22,
    cadence: 2.4,
    lift: 0.07,
    bob: 0.008,
    crouch: 0,
    hipShift: 0.004,
    lean: 0.04,
    armSwing: 0.6,
    armHang: 0.05,
    gazeY: -0.1,
    headTilt: 0.04,
    contactSquash: 0.2,
    apex: 0.07,
    land: 0.14,
    flight: 0.5,
    mood: { id: 'excited', intensity: 0.7 },
    start: skipStart,
    stop: skipTwirl,
  },
  trudge: {
    id: 'trudge',
    label: 'Trudge',
    description: 'Lazy and reluctant: slumped, head low, dragging feet, sighs on the way.',
    cycle: 'step',
    stride: 0.08,
    cadence: 1.5,
    lift: 0.012,
    bob: 0.022,
    crouch: 0.008,
    hipShift: 0.009,
    lean: 0.07,
    armSwing: 0.04,
    armHang: -0.08,
    gazeY: 0.45,
    headTilt: 0.06,
    contactSquash: 0.25,
    apex: 0,
    land: 0,
    flight: 0,
    mood: { id: 'sad', intensity: 0.75 },
    start: groanSigh,
    stop: slumpHmph,
    pause: { every: 1.6, beat: trudgePause },
  },
  scurry: {
    id: 'scurry',
    label: 'Scurry',
    description: 'Quick small steps, arms tucked; shy or urgent.',
    cycle: 'step',
    stride: 0.06,
    cadence: 3.8,
    lift: 0.02,
    bob: 0.004,
    crouch: 0.004,
    hipShift: 0.002,
    lean: 0.06,
    armSwing: 0.08,
    armHang: -0.12,
    gazeY: 0.15,
    headTilt: 0,
    contactSquash: 0.05,
    apex: 0,
    land: 0,
    flight: 0,
    mood: { id: 'worried', intensity: 0.5 },
  },
  sneak: {
    id: 'sneak',
    label: 'Sneak',
    description: 'Tiptoe, crouched, high careful lifts and slow touchdowns.',
    cycle: 'step',
    stride: 0.07,
    cadence: 1.6,
    lift: 0.045,
    bob: 0.004,
    crouch: 0.024,
    hipShift: 0.003,
    lean: 0.05,
    armSwing: 0.03,
    armHang: -0.18,
    gazeY: 0,
    headTilt: -0.03,
    contactSquash: 0,
    apex: 0,
    land: 0,
    flight: 0,
    mood: { id: 'focused', intensity: 0.6 },
    start: sneakLook,
  },
  stomp: {
    id: 'stomp',
    label: 'Stomp',
    description: 'Annoyed, heavy steps, stiff arms, a frown.',
    cycle: 'step',
    stride: 0.11,
    cadence: 2.3,
    lift: 0.045,
    bob: 0.02,
    crouch: 0,
    hipShift: 0.005,
    lean: 0.05,
    armSwing: 0.28,
    armHang: -0.05,
    gazeY: 0.1,
    headTilt: 0,
    contactSquash: 0.45,
    apex: 0,
    land: 0,
    flight: 0,
    mood: { id: 'annoyed', intensity: 0.8 },
    stop: stompStop,
  },
  run: {
    id: 'run',
    label: 'Run',
    description: 'A jog with short flight phases, for long trips.',
    cycle: 'run',
    stride: 0.2,
    cadence: 3.2,
    lift: 0.05,
    bob: 0,
    crouch: 0,
    hipShift: 0.002,
    lean: 0.07,
    armSwing: 0.35,
    armHang: 0,
    gazeY: 0,
    headTilt: 0,
    contactSquash: 0.1,
    apex: 0.035,
    land: 0.08,
    flight: 0.45,
    mood: { id: 'determined', intensity: 0.4 },
  },
  hop: {
    id: 'hop',
    label: 'Bunny hop',
    description: 'Playful two-footed hops; only when chosen, never the default.',
    cycle: 'hop',
    stride: 0.3,
    cadence: 2.2,
    lift: 0.025,
    bob: 0,
    crouch: 0,
    hipShift: 0,
    lean: 0.05,
    armSwing: 0.25,
    armHang: 0,
    gazeY: -0.05,
    headTilt: 0,
    contactSquash: 0,
    apex: 0.12,
    land: 0.2,
    flight: 0.7,
    mood: { id: 'grin', intensity: 0.6 },
  },
};

/** Legacy cue gait names (shared/locomotion.ts) mapped onto the library. */
export const gaitAliases: Readonly<Record<string, GaitId>> = {
  stroll: 'amble',
  hurry: 'scurry',
  tiptoe: 'sneak',
  step: 'walk',
  scoot: 'scurry',
  tired: 'trudge',
};

export function resolveGait(id: string | undefined): GaitId | undefined {
  if (!id) return undefined;
  if ((gaitIds as readonly string[]).includes(id)) return id as GaitId;
  return gaitAliases[id];
}

/**
 * Authored gait cycles a remixed rig may provide (manifest locomotion handles), used instead of
 * the procedural cycle when present. Loop lengths are one full cycle (two steps / two skips).
 */
export const authoredGaitClips: Readonly<Record<GaitId, { handle: string; loop: string }>> = {
  walk: { handle: 'walk-cycle', loop: '2 steps, 0.7 s at 60 fps (42 frames)' },
  amble: { handle: 'amble-cycle', loop: '2 steps, 0.9 s' },
  skip: { handle: 'skip-cycle', loop: '2 skips, 0.83 s, contact on frames 0 and 25' },
  trudge: { handle: 'trudge-cycle', loop: '2 steps, 1.33 s, toe drag on the swing' },
  scurry: { handle: 'scurry-cycle', loop: '2 steps, 0.53 s' },
  sneak: { handle: 'sneak-cycle', loop: '2 steps, 1.25 s, tiptoe contacts' },
  stomp: { handle: 'stomp-cycle', loop: '2 steps, 0.87 s, heavy heel strikes' },
  run: { handle: 'run-cycle', loop: '2 strides, 0.62 s, flight between contacts' },
  hop: { handle: 'hop-cycle', loop: '1 hop, 0.45 s' },
};
