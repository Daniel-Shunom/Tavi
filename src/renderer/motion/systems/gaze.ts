// Gaze: fixations held for exponentially distributed times, quick saccades between them,
// micro-saccades inside a fixation, and a slower head that follows the eyes.
// Research: saccades last 25 ms + 2.4 ms/deg and most are < 15 deg; gaze-away glances are short
// (~0.4-0.9 s) while listening holds are long (Lee, Badler & Badler 2002 "Eyes Alive");
// eyes lead the head, which joins only for larger shifts (Ruhland et al. 2015).
// Shy characters avert gaze more (Neff et al. 2010).
import { exponential, range, rngFor, type Rng } from '../core/random';
import { SecondOrder } from '../core/spring';
import type { MotionProfile } from '../profile';

export interface GazeTarget {
  x: number;
  y: number;
}

interface Fixation {
  x: number;
  y: number;
  until: number;
  away: boolean;
}

const wanderPoints: readonly (GazeTarget & { weight: number })[] = [
  { x: 0, y: 0, weight: 3 },
  { x: 0.65, y: 0.05, weight: 2 },
  { x: -0.65, y: 0.05, weight: 2 },
  { x: 0.3, y: 0.45, weight: 1 },
  { x: -0.3, y: 0.45, weight: 1 },
  { x: 0.5, y: -0.35, weight: 0.7 },
  { x: -0.5, y: -0.35, weight: 0.7 },
];

export class GazeSystem {
  private rng: Rng;
  private fixation: Fixation | null = null;
  private microAt = 0;
  private micro = { x: 0, y: 0 };
  private eyesX = new SecondOrder({ f: 5, zeta: 0.9, r: 0 }, 0);
  private eyesY = new SecondOrder({ f: 5, zeta: 0.9, r: 0 }, 0);
  private head = new SecondOrder({ f: 1.6, zeta: 0.8, r: 0 }, 0);
  private lastTarget: GazeTarget | null = null;

  constructor(seed: number) {
    this.rng = rngFor(seed, 'gaze');
  }

  private choose(now: number, profile: MotionProfile, target: GazeTarget | null): Fixation {
    const rng = this.rng;
    if (target) {
      const wasAway = this.fixation?.away ?? false;
      if (!wasAway && rng() < profile.gazeAwayBias * 0.6) {
        // Shy glances down-and-aside; others glance sideways or up as if thinking.
        const side = rng() < 0.5 ? -1 : 1;
        const down = rng() < profile.gazeAwayBias;
        return {
          x: target.x * 0.3 + side * range(rng, 0.45, 0.75),
          y: down ? range(rng, 0.3, 0.55) : range(rng, -0.3, 0.1),
          until: now + exponential(rng, 0.7, 0.3, 2.2),
          away: true,
        };
      }
      return {
        x: target.x + range(rng, -0.06, 0.06),
        y: target.y + range(rng, -0.04, 0.04),
        until: now + exponential(rng, profile.gazeHoldMean * 1.5, 0.6, 9),
        away: false,
      };
    }
    const total = wanderPoints.reduce((sum, p) => sum + p.weight, 0);
    let roll = rng() * total;
    let point = wanderPoints[0] ?? { x: 0, y: 0, weight: 1 };
    for (const candidate of wanderPoints) {
      roll -= candidate.weight;
      if (roll < 0) {
        point = candidate;
        break;
      }
    }
    return {
      x: point.x + range(rng, -0.1, 0.1),
      y: point.y + range(rng, -0.06, 0.06),
      until: now + exponential(rng, profile.gazeHoldMean, 0.5, 8),
      away: point.x !== 0 || point.y !== 0,
    };
  }

  /** Jump straight to a target (used when a reaction demands immediate attention). */
  snap(now: number, profile: MotionProfile, target: GazeTarget) {
    this.fixation = {
      x: target.x,
      y: target.y,
      until: now + exponential(this.rng, profile.gazeHoldMean * 1.5, 0.6, 9),
      away: false,
    };
  }

  update(dt: number, now: number, profile: MotionProfile, target: GazeTarget | null) {
    let saccade = 0;
    const targetChanged =
      (target === null) !== (this.lastTarget === null) ||
      (target !== null &&
        this.lastTarget !== null &&
        Math.hypot(target.x - this.lastTarget.x, target.y - this.lastTarget.y) > 0.2);
    this.lastTarget = target ? { ...target } : null;
    if (!this.fixation || now >= this.fixation.until || targetChanged) {
      const previous = this.fixation;
      this.fixation = this.choose(now, profile, target);
      saccade = previous
        ? Math.hypot(this.fixation.x - previous.x, this.fixation.y - previous.y)
        : 0;
    }
    if (now >= this.microAt) {
      this.micro = { x: range(this.rng, -0.025, 0.025), y: range(this.rng, -0.02, 0.02) };
      this.microAt = now + range(this.rng, 0.5, 1.3);
    }
    this.eyesX.set(profile.gaze);
    this.eyesY.set(profile.gaze);
    this.head.set(profile.head);
    const fx = Math.max(-1, Math.min(1, this.fixation.x + this.micro.x));
    const fy = Math.max(-1, Math.min(1, this.fixation.y + this.micro.y));
    const x = this.eyesX.update(dt, fx);
    const y = this.eyesY.update(dt, fy);
    // Head roll follows the look direction slowly and a little (eyes lead the head).
    const headTilt = this.head.update(dt, fx * 0.06 + fy * 0.02) * profile.amplitude;
    return { x, y, headTilt, saccade, away: this.fixation.away };
  }
}
