// Idle fidgets ("idle breaks"): small self-motivated actions at randomised, non-repeating
// intervals. Low amplitude by design: a companion should not pull focus from the stream
// (staging: "in a still scene the eye is attracted to movement"; the Clippy lesson).
import { smootherstep } from '../core/curves';
import { exponential, pick, rngFor, type Rng } from '../core/random';
import type { MotionProfile } from '../profile';
import type { Pose } from '../types';

/** In, hold, out envelope (seconds). */
export function bump(t: number, attack: number, hold: number, release: number) {
  if (t <= 0) return 0;
  if (t < attack) return smootherstep(t / attack);
  if (t < attack + hold) return 1;
  return 1 - smootherstep((t - attack - hold) / release);
}

export interface FidgetDef {
  duration: number;
  pose: (t: number, side: number) => Partial<Pose>;
}

export const fidgets: Readonly<Record<string, FidgetDef>> = {
  glance: {
    duration: 1.4,
    pose: (t, side) => ({
      gazeX: 0.7 * side * bump(t, 0.12, 0.8, 0.35),
      headTilt: 0.04 * side * bump(t, 0.3, 0.6, 0.45),
    }),
  },
  lookAround: {
    duration: 3,
    pose: (t, side) => {
      const sweep = Math.sin(Math.min(1, t / 2.6) * Math.PI * 2) * side;
      const env = bump(t, 0.3, 2, 0.6);
      return {
        gazeX: 0.75 * sweep * env,
        gazeY: -0.15 * env,
        headTilt: 0.05 * sweep * env,
        lean: -0.01 * env,
      };
    },
  },
  weightShift: {
    duration: 3.2,
    pose: (t, side) => {
      const env = bump(t, 0.7, 1.6, 0.9);
      return {
        shift: 0.012 * side * env,
        lean: -0.035 * side * env,
        bob: 0.004 * env,
        headTilt: 0.03 * side * env,
        footLY: side < 0 ? 0 : 0.006 * bump(t - 0.2, 0.15, 0.05, 0.2),
      };
    },
  },
  sigh: {
    duration: 2.6,
    pose: (t) => {
      const inhale = bump(t, 0.6, 0.15, 0.5);
      const exhale = bump(t - 0.9, 0.3, 0.6, 0.8);
      return {
        squash: -0.5 * inhale + 0.45 * exhale,
        armL: 0.12 * inhale - 0.04 * exhale,
        armR: 0.12 * inhale - 0.04 * exhale,
        gazeY: 0.35 * exhale,
        squintL: 0.4 * exhale,
        squintR: 0.4 * exhale,
        headTilt: 0.03 * exhale,
        bob: 0.006 * exhale,
      };
    },
  },
  stretch: {
    duration: 3,
    pose: (t) => {
      const env = bump(t, 0.8, 1, 0.9);
      return {
        armL: 0.9 * env,
        armR: 0.9 * env,
        squash: -0.8 * env,
        lean: -0.03 * env,
        blinkL: 0.85 * env,
        blinkR: 0.85 * env,
        smile: 0.4 * env,
        bob: -0.006 * env,
      };
    },
  },
  hairFlick: {
    duration: 1.3,
    pose: (t, side) => {
      const flick = Math.sin(Math.min(1, t / 1.1) * Math.PI * 3) * (1 - Math.min(1, t / 1.2));
      return {
        hairSwoop: 0.8 * side * flick,
        headTilt: 0.08 * side * bump(t, 0.12, 0.15, 0.5),
        blinkL: bump(t, 0.06, 0.04, 0.12) * 0.9,
        blinkR: bump(t, 0.06, 0.04, 0.12) * 0.9,
      };
    },
  },
  footTap: {
    duration: 1.8,
    pose: (t, side) => {
      const taps = Math.max(0, Math.sin((t / 0.45) * Math.PI * 2)) * bump(t, 0.1, 1.3, 0.3);
      return side > 0
        ? { footRY: 0.012 * taps, gazeY: 0.15 * bump(t, 0.2, 1.2, 0.3) }
        : { footLY: 0.012 * taps, gazeY: 0.15 * bump(t, 0.2, 1.2, 0.3) };
    },
  },
  smallSmile: {
    duration: 2.4,
    pose: (t) => {
      const env = bump(t, 0.35, 1.4, 0.6);
      return { smile: 0.6 * env, squintL: 0.35 * env, squintR: 0.35 * env, headTilt: 0.03 * env };
    },
  },
};

export class FidgetSystem {
  private rng: Rng;
  private next: number | null = null;
  private current: { id: string; start: number; side: number } | null = null;
  private last: string | undefined;

  constructor(seed: number) {
    this.rng = rngFor(seed, 'fidget');
  }

  /** Cancel the running fidget (a reaction or movement takes over). */
  interrupt() {
    this.current = null;
  }

  update(
    now: number,
    profile: MotionProfile,
    busy: boolean,
  ): { id: string | null; pose: Partial<Pose> } {
    if (!Number.isFinite(profile.fidgetMean)) {
      this.current = null;
      this.next = null;
      return { id: null, pose: {} };
    }
    this.next ??=
      now +
      exponential(this.rng, profile.fidgetMean, profile.fidgetMean * 0.4, profile.fidgetMean * 2.5);
    if (this.current) {
      const def = fidgets[this.current.id];
      const t = now - this.current.start;
      if (def && t < def.duration)
        return { id: this.current.id, pose: def.pose(t, this.current.side) };
      this.current = null;
    }
    if (busy) {
      // Postpone: an idle break should only happen while genuinely idle.
      if (this.next < now + 1.5) this.next = now + 1.5;
      return { id: null, pose: {} };
    }
    if (now >= this.next) {
      const options = Object.entries(profile.fidgetWeights)
        .filter(([id]) => id in fidgets)
        .map(([id, weight]) => ({ id, weight }));
      const id = pick(this.rng, options, this.last);
      this.last = id;
      this.current = { id, start: now, side: this.rng() < 0.5 ? -1 : 1 };
      this.next =
        now +
        exponential(
          this.rng,
          profile.fidgetMean,
          profile.fidgetMean * 0.4,
          profile.fidgetMean * 2.5,
        );
      const def = fidgets[id];
      return { id, pose: def ? def.pose(0, this.current.side) : {} };
    }
    return { id: null, pose: {} };
  }
}
