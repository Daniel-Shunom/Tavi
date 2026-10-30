import type { ExpressionId } from '../../shared/expressions';
import type { LifeCue } from './life';

// How Tavi reacts to the visitor on the landing page (bounded local rules, not AI). Each
// reaction has a visible cause in what the visitor just did, and reads in her face, so it may
// play while she moves; anything with her body (a hop and wave) waits until she is free.

export interface ReactionInput {
  dt: number;
  /** The pointer is close to her (about a body and a half). */
  pointerNear: boolean;
  /** The pointer is right on her. */
  pointerOn: boolean;
  /** She has just started a leap to another part of the page, and how fast the visitor scrolled. */
  departing: boolean;
  /** Visitor scroll speed in viewport heights per second. */
  scrollPace: number;
  /** She has just touched down after a fall that skipped at least one section. */
  longFallLanded: boolean;
  /** She has just landed back on the desk after a trip down the page. */
  homeAgain: boolean;
  /** The visitor came back to the page after a while away (tab or window). */
  returned: boolean;
  /** She is standing or sitting still with nothing else going on, so she can hop and wave. */
  free: boolean;
}

export interface ReactionFrame {
  /** A face reaction playing now, or null. */
  cue: LifeCue | null;
  /** Ask her to greet the visitor (hop and wave) this frame. */
  greet: boolean;
}

/** A scroll faster than this (viewport heights per second) catches her off guard. */
export const FAST_SCROLL = 1.6;
/** Away from the page this long counts as a return worth greeting (seconds). */
export const AWAY = 15;

const clamp = (n: number, low = 0, high = 1) => Math.max(low, Math.min(high, n));

export class VisitorReactions {
  private clock = 0;
  private cue: LifeCue | null = null;
  private until = 0;
  private n = 1000;
  private farFor = Infinity;
  private onFor = 0;
  private shyStep = 0;
  private ready: Partial<Record<ExpressionId, number>> = {};
  private greetOwed = false;

  private play(id: ExpressionId, hold: number, cooldown: number) {
    if (this.clock < (this.ready[id] ?? 0)) return;
    this.n++;
    this.cue = { id, n: this.n, hold };
    this.until = this.clock + hold;
    this.ready[id] = this.clock + cooldown;
  }

  update(input: ReactionInput): ReactionFrame {
    const dt = clamp(input.dt, 0, 0.05);
    this.clock += dt;
    if (this.cue && this.clock >= this.until) this.cue = null;

    // Caught off guard by a fast scroll as she sets off after the visitor.
    if (input.departing && input.scrollPace > FAST_SCROLL) this.play('startled', 0.9, 2);
    // A long drop, landed clean: a little pleased with herself.
    if (input.longFallLanded) this.play('proud', 1.6, 6);
    // Back home on the desk with the visitor.
    if (input.homeAgain) this.play('excited', 1.6, 6);

    // Noticing a pointer that comes close after being away: a soft smile.
    if (input.pointerNear) {
      if (this.farFor > 4) this.play('soft-smile', 1.4, 6);
      this.farFor = 0;
    } else this.farFor += dt;

    // A pointer resting right on her: shy first, then a giggle if it stays.
    if (input.pointerOn) {
      this.onFor += dt;
      if (this.shyStep === 0 && this.onFor > 0.5) {
        this.shyStep = 1;
        this.play('blush', 2, 8);
      } else if (this.shyStep === 1 && this.onFor > 3) {
        this.shyStep = 2;
        this.play('amused', 2, 10);
      }
    } else {
      this.onFor = 0;
      this.shyStep = 0;
    }

    // A returning visitor gets a proper hello once she is free to give one.
    if (input.returned) this.greetOwed = true;
    const greet = this.greetOwed && input.free;
    if (greet) this.greetOwed = false;
    return { cue: this.cue, greet };
  }
}
