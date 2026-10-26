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
import {
  channelGroup,
  discreteChannels,
  faceChannels,
  mirroredPairs,
  sidedChannels,
  type FaceChannel,
  type FaceValues,
} from './channels';
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
  /** Side of the attention target (1 = screen right), for poses that turn toward it. */
  side?: -1 | 1;
}
export interface ActingClip {
  /** Clip role from the character's motion binding. */
  role: string;
  /** Seconds into the clip. */
  time: number;
  mix: number;
}
export interface FaceInput {
  dt: number;
  /** Seconds of local animation time (drives living micro-motion). */
  time: number;
  cues: readonly FaceCue[];
  reducedMotion?: boolean;
  /**
   * Personality and energy (the motion profile): `amplitude` scales how far each pose goes
   * (as intensity, capped at strong), `tempo` speeds up or slows down onsets and micro-acting.
   */
  amplitude?: number;
  tempo?: number;
  /**
   * Channels a body state currently holds (e.g. sitting owns `bob` and the feet; dozing owns
   * almost everything). Acting leaves them alone, easing out through the springs, so expressions
   * layer over sit, perch, lean or peek instead of fighting them.
   */
  held?: ReadonlySet<FaceChannel>;
}
export interface FaceOutput {
  /** Additive offsets in motion channel units, clamped to the rig's safe ranges. */
  values: FaceValues;
  /** Blink settings in effect, for a motion layer that schedules its own blinks. */
  blink: { rate: number; hold: number };
  /** Expressions contributing this frame. */
  active: ExpressionId[];
  /** Authored clips requested by active poses, mixed by their envelopes. */
  clips: ActingClip[];
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
  head: 0.1,
  body: 0.11,
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
  headTilt: { amount: 0.012, hz: 0.07 },
  lean: { amount: 0.008, hz: 0.09 },
  bob: { amount: 0.002, hz: 0.21 },
  armL: { amount: 0.035, hz: 0.12 },
  armR: { amount: 0.035, hz: 0.1 },
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
    const discreteWeight: Partial<Record<FaceChannel, number>> = {};
    let dominant: FaceCue | null = null;
    let drift = 0;
    for (const cue of input.cues) {
      const def = this.face.poses[cue.expression];
      if (!def || cue.weight <= 0) continue;
      if (!dominant || cue.weight * cue.intensity > dominant.weight * dominant.intensity)
        dominant = cue;
      const intensity = Math.min(1, cue.intensity * (input.amplitude ?? 1));
      const sample = sampleFacePose(def, intensity, cue.elapsed * (input.tempo ?? 1));
      const flip = def.towardTarget && cue.side === -1;
      for (const [authored, value] of Object.entries(sample) as [FaceChannel, number][]) {
        const name = flip ? (mirroredPairs[authored] ?? authored) : authored;
        const group = channelGroup[name];
        if (cue.featuresOnly && (group === 'head' || group === 'body')) continue;
        if (input.held?.has(name)) continue;
        if (discreteChannels.has(name)) {
          // Pose indices: the most present cue wins once it is reasonably in.
          if (cue.weight >= 0.35 && cue.weight > (discreteWeight[name] ?? 0)) {
            values[name] = Math.round(value);
            discreteWeight[name] = cue.weight;
          }
          continue;
        }
        const signed = flip && sidedChannels.has(name) ? -value : value;
        values[name] = (values[name] ?? 0) + signed * cue.weight;
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
    const longest = Math.max(this.face.mouthLag, this.face.bodyLag);
    while (this.history.length > 2 && (this.history[1]?.time ?? Infinity) <= input.time - longest)
      this.history.shift();
    /** The target as it was `lag` seconds ago (overlapping action). */
    const past = (lag: number) => {
      let found = this.history[0]?.values ?? target;
      for (const entry of this.history) if (entry.time <= input.time - lag) found = entry.values;
      return found;
    };
    const mouth = past(this.face.mouthLag),
      body = past(this.face.bodyLag);
    const out: FaceValues = {};
    for (const name of faceChannels) {
      if (!this.face.channels[name]) continue;
      const group = channelGroup[name];
      const source = group === 'mouth' ? mouth : group === 'body' ? body : target;
      const goal = source[name] ?? 0;
      if (discreteChannels.has(name)) {
        if (goal !== 0) out[name] = goal;
        continue;
      }
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
      clips: this.clips(input.cues),
    };
  }

  private clips(cues: readonly FaceCue[]): ActingClip[] {
    const out: ActingClip[] = [];
    for (const cue of cues) {
      const clip = this.face.poses[cue.expression]?.clip;
      if (!clip || cue.weight <= 0.001 || cue.featuresOnly) continue;
      let time = (clip.start ?? 0) + Math.max(0, cue.elapsed) * (clip.rate ?? 1);
      if (clip.pingPong && time > clip.pingPong[0]) {
        const [from, to] = clip.pingPong;
        const span = Math.max(0.05, to - from);
        const cycle = (time - from) % (2 * span);
        time = from + (cycle < span ? cycle : 2 * span - cycle);
      }
      out.push({ role: clip.role, time, mix: clip.mix * Math.min(1, cue.weight) });
    }
    return out;
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
