// Spontaneous blinks as a seeded Poisson process.
// Research: ~17 blinks/min at rest, more in conversation, fewer when attending (Bentivoglio 1997);
// closing ~2x faster than opening (Evinger 1991); asymmetric data-driven blinks read more natural
// than symmetric ease curves (Trutoiu 2011); Live2D default close 0.1 s / closed 0.05 s / open 0.15 s.
// Blinks cluster on large gaze shifts (Evinger 1994), exposed via trigger().
import { exponential, rngFor, type Rng } from '../core/random';
import type { MotionProfile } from '../profile';

const CLOSE = 0.075;
const CLOSED = 0.045;
const OPEN = 0.17;
export const BLINK_LENGTH = CLOSE + CLOSED + OPEN;

/** 0 open .. 1 closed over one blink starting at t = 0. */
export function blinkShape(t: number) {
  if (t <= 0 || t >= BLINK_LENGTH) return 0;
  if (t < CLOSE) {
    const x = t / CLOSE;
    return x * x; // accelerating close
  }
  if (t < CLOSE + CLOSED) return 1;
  const x = (t - CLOSE - CLOSED) / OPEN;
  const out = 1 - x;
  return out * out * (1 + 0.6 * x); // decelerating open with a soft finish
}

export class BlinkSystem {
  private rng: Rng;
  private next = 0;
  private starts: number[] = [];
  private initialised = false;

  constructor(seed: number) {
    this.rng = rngFor(seed, 'blink');
  }

  /** Force a blink (gaze shift, landing, reaction accent). Ignored if one is already running. */
  trigger(now: number) {
    const last = this.starts.at(-1);
    if (last !== undefined && now - last < BLINK_LENGTH + 0.12) return;
    this.starts.push(now);
  }

  update(now: number, profile: MotionProfile, attentive = false) {
    if (!this.initialised) {
      this.initialised = true;
      this.next = exponential(this.rng, profile.blinkMean, 0.6, profile.blinkMean * 3);
    }
    // Attending lowers the blink rate (reading/listening ~4.5-17/min vs 17-26 in conversation).
    const mean = profile.blinkMean * (attentive ? 1.4 : 1);
    while (this.next <= now) {
      this.starts.push(this.next);
      if (this.rng() < profile.doubleBlinkChance) this.starts.push(this.next + BLINK_LENGTH + 0.06);
      this.next += exponential(this.rng, mean, 0.6, mean * 3);
    }
    while (this.starts.length > 4) this.starts.shift();
    let left = 0,
      right = 0;
    for (const start of this.starts) {
      left = Math.max(left, blinkShape(now - start));
      // The right eye trails by ~12 ms: avoids perfectly mirrored "twins" (Lasseter 1987).
      right = Math.max(right, blinkShape(now - start - 0.012));
    }
    return { left, right };
  }
}
