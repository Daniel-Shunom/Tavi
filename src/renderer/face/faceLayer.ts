// Face pose layer: turns active expression cues into smooth, living facial channel offsets that add
// onto the motion layer's pose (same channel names and units, see channels.ts).
//
// Per frame:
//   1. target   = sum over cues of envelope weight x sampleFacePose (intensity, time since start)
//   2. living   = small incommensurate drifts on brows, lids, mouth and gaze, so holds never freeze
//   3. overlap  = the mouth chases the target as it was `mouthLag` seconds ago (brows lead)
//   4. springs  = every channel follows its target with a critically damped spring: retargeting
//                 mid-transition stays continuous in value and velocity (inertialization-like)
//   5. blinks   = scheduled blinks (rate and hold from the dominant pose) layered over the lids
//   6. clamp    = the rig's safe ranges from the manifest
import type { ExpressionId } from '../../../shared/expressions';
import { channelGroup, faceChannels, type FaceChannel, type FaceValues } from './channels';
import { clampToRig, sampleFacePose, type CharacterFace } from './pose';
import { stepSpring, type SpringState } from './spring';

export interface FaceCue {
  expression: ExpressionId;
  intensity: number;
  /** Envelope weight 0..1 from the cue timeline. */
  weight: number;
  /** Seconds since the beat started. */
  elapsed: number;
  /**
   * The motion layer performs this cue's head and body (e.g. the Oops performance): supply only
   * the facial features (brows, lids, mouth, gaze), not head tilt or squash.
   */
  featuresOnly?: boolean;
}
export interface FaceInput {
  dt: number;
  /** Seconds of local animation time (drives living micro-motion). */
  time: number;
  cues: readonly FaceCue[];
  reducedMotion?: boolean;
}
export interface FaceOutput {
  /** Additive offsets in motion channel units, clamped to the rig's safe ranges. */
  values: FaceValues;
  /** Blink settings in effect, for a motion layer that schedules its own blinks. */
  blink: { rate: number; hold: number };
  /** Expressions contributing this frame. */
  active: ExpressionId[];
}
export interface FaceLayerOptions {
  seed?: number;
  /** Schedule blinks here (default). Set false when the motion layer owns blinking. */
  ownBlinks?: boolean;
}

/** Half-lives per channel group, in seconds. The upper face is quicker than the mouth. */
export const halfLives: Record<(typeof channelGroup)[FaceChannel], number> = {
  brows: 0.055,
  eyes: 0.05,
  mouth: 0.08,
  head: 0.12,
};

const DRIFT: Partial<Record<FaceChannel, { amount: number; hz: number }>> = {
  browL: { amount: 0.07, hz: 0.31 },
  browR: { amount: 0.07, hz: 0.27 },
  squintL: { amount: 0.04, hz: 0.19 },
  squintR: { amount: 0.04, hz: 0.23 },
  smile: { amount: 0.06, hz: 0.17 },
  mouthX: { amount: 0.05, hz: 0.13 },
  gazeX: { amount: 0.035, hz: 0.11 },
  gazeY: { amount: 0.025, hz: 0.09 },
  headTilt: { amount: 0.008, hz: 0.07 },
};

/** Smooth deterministic noise in about -1..1 from three incommensurate sines. */
function wobble(seed: number, t: number, hz: number) {
  const p = seed * 12.9898;
  return (
    0.55 * Math.sin(2 * Math.PI * hz * t + p) +
    0.3 * Math.sin(2 * Math.PI * hz * 2.17 * t + p * 1.7) +
    0.15 * Math.sin(2 * Math.PI * hz * 4.31 * t + p * 2.3)
  );
}
function hash(n: number) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}
/** Closed amount of a blink `t` seconds after it began: ~70 ms down, hold, ~110 ms up. */
export function blinkShape(t: number, hold: number) {
  const close = 0.07,
    open = 0.11;
  if (t < 0) return 0;
  if (t < close) return Math.sin(((t / close) * Math.PI) / 2);
  if (t < close + hold) return 1;
  const x = (t - close - hold) / open;
  return x >= 1 ? 0 : 1 - x * x * (3 - 2 * x);
}

export class FaceLayer {
  private readonly springs = new Map<FaceChannel, SpringState>();
  // Starts with the rest pose so the mouth trails from the very first cue.
  private readonly history: { time: number; values: FaceValues }[] = [
    { time: -Infinity, values: {} },
  ];
  private nextBlink: number;
  private blinkStart = -10;
  private blinkHold = 0.04;
  private blinkCount = 0;
  private readonly seed: number;
  private readonly ownBlinks: boolean;

  constructor(
    private readonly face: CharacterFace,
    options: FaceLayerOptions = {},
  ) {
    this.seed = options.seed ?? 1;
    this.ownBlinks = options.ownBlinks ?? true;
    this.nextBlink = 1.2 + 2 * hash(this.seed);
    for (const name of faceChannels) this.springs.set(name, { value: 0, velocity: 0 });
  }

  /** Raw target before springs: weighted poses plus living drift. */
  target(input: FaceInput): { values: FaceValues; dominant: FaceCue | null } {
    const values: FaceValues = {};
    let dominant: FaceCue | null = null;
    let drift = 0;
    for (const cue of input.cues) {
      const def = this.face.poses[cue.expression];
      if (!def || cue.weight <= 0) continue;
      if (!dominant || cue.weight * cue.intensity > dominant.weight * dominant.intensity)
        dominant = cue;
      const sample = sampleFacePose(def, cue.intensity, cue.elapsed);
      for (const [name, value] of Object.entries(sample) as [FaceChannel, number][]) {
        if (cue.featuresOnly && channelGroup[name] === 'head') continue;
        values[name] = (values[name] ?? 0) + value * cue.weight;
      }
      drift = Math.max(drift, (def.living?.drift ?? 0.5) * cue.weight);
    }
    if (!input.reducedMotion && drift > 0)
      for (const [name, spec] of Object.entries(DRIFT) as [
        FaceChannel,
        { amount: number; hz: number },
      ][]) {
        const offset =
          spec.amount * drift * wobble(this.seed + name.length * 7, input.time, spec.hz);
        // Lids only drift downward from where they are, never below open.
        values[name] =
          (values[name] ?? 0) + (name.startsWith('squint') ? Math.abs(offset) : offset);
      }
    return { values, dominant };
  }

  update(input: FaceInput): FaceOutput {
    const dt = Math.max(0, Math.min(0.1, input.dt));
    const { values: target, dominant } = this.target(input);
    this.history.push({ time: input.time, values: target });
    const lag = this.face.mouthLag;
    while (this.history.length > 2 && (this.history[1]?.time ?? Infinity) <= input.time - lag)
      this.history.shift();
    const lagged = this.history[0]?.values ?? target;
    const out: FaceValues = {};
    for (const name of faceChannels) {
      if (!this.face.channels[name]) continue;
      const group = channelGroup[name];
      const goal = (group === 'mouth' ? lagged[name] : target[name]) ?? 0;
      const spring = this.springs.get(name);
      if (!spring) continue;
      stepSpring(spring, goal, halfLives[group], dt);
      if (Math.abs(spring.value) > 1e-5) out[name] = spring.value;
    }
    const def = dominant ? this.face.poses[dominant.expression] : undefined;
    const rate = def?.living?.blinkRate ?? this.face.blink.rate;
    const hold = def?.living?.blinkHold ?? this.face.blink.hold;
    if (this.ownBlinks && !input.reducedMotion) this.blink(input.time, rate, hold, out);
    return {
      values: clampToRig(out, this.face),
      blink: { rate, hold },
      active: input.cues
        .filter((cue) => cue.weight > 0.01 && this.face.poses[cue.expression])
        .map((cue) => cue.expression),
    };
  }

  private blink(time: number, rate: number, hold: number, out: FaceValues) {
    if (time < this.blinkStart) this.nextBlink = time + 1; // clock went backwards (seek)
    if (rate > 0 && time >= this.nextBlink) {
      this.blinkStart = time;
      this.blinkHold = hold;
      this.blinkCount++;
      const mean = 60 / rate;
      // Irregular gaps (0.45x..1.6x the mean), with an occasional quick double blink.
      const double = hash(this.seed * 31 + this.blinkCount) < 0.12;
      this.nextBlink =
        time + (double ? 0.32 : mean * (0.45 + 1.15 * hash(this.seed + this.blinkCount)));
    } else if (rate <= 0 && this.nextBlink < time + 4) this.nextBlink = time + 4;
    const closed = blinkShape(time - this.blinkStart, this.blinkHold);
    if (closed <= 0) return;
    for (const name of ['blinkL', 'blinkR'] as const) {
      // The right eye trails by a frame: perfectly mirrored blinks look mechanical.
      const lagged =
        name === 'blinkR' ? blinkShape(time - this.blinkStart - 0.012, this.blinkHold) : closed;
      const base = Math.max(0, out[name] ?? 0);
      out[name] = base + (1 - base) * lagged;
    }
  }

  /** Current spring state (for tests and the expression sheet). */
  snapshot(): FaceValues {
    const out: FaceValues = {};
    for (const [name, spring] of this.springs) out[name] = spring.value;
    return out;
  }
}
