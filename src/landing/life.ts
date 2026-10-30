import type { ExpressionId } from '../../shared/expressions';

// Tavi's idle life on the landing page (bounded local rules, not AI). Three simple drives change
// for visible reasons, and what she does falls out of them, gated by where she is:
// - energy: travel, jumps and big landings tire her; resting brings it back;
// - boredom: rises while nothing happens, falls when the visitor does something or she acts;
// - interest: rises while the visitor's pointer is near her, fades when it leaves.
// Every move must make visual sense: it has a cause, fits the surface she is on, and only plays
// while she is still. Big moves need room (the desk, the closing floor); on a narrow edge she
// keeps to seated, small things (swinging her legs, a yawn, a doze).

export type Posture = 'busy' | 'stand' | 'perch' | 'floor-sit';

export interface LifeInput {
  dt: number;
  posture: Posture;
  /** Standing room for big moves: the desk or the closing floor, not an edge or the TV top. */
  roomy: boolean;
  /** How hard she is working right now, 0..1 (travel speed; time in the air). */
  exertion: number;
  /** Landing compression on the frame she touches down, else 0. */
  impact: number;
  /** The visitor moved the pointer or scrolled in the last couple of seconds. */
  visitorActive: boolean;
  /** The visitor's pointer is close to her. */
  visitorNear: boolean;
}

export interface LifeCue {
  id: ExpressionId;
  /** Changes for every new cue, so the same expression can play again later. */
  n: number;
  /** Seconds the cue holds. */
  hold: number;
}

export interface LifeFrame {
  energy: number;
  boredom: number;
  interest: number;
  /** The move she is playing now, or null. */
  cue: LifeCue | null;
  /** Leg swing amplitude while perched, 0..1. */
  legSwing: number;
  dozing: boolean;
  /** Seconds her routine should wait so a move is never cut off by walking away. */
  pause: number;
}

const clamp = (n: number, low = 0, high = 1) => Math.max(low, Math.min(high, n));
const approach = (n: number, to: number, step: number) => n + clamp(to - n, -step, step);

/** How long each move plays, and the least time before it may play again. */
const MOVES: Partial<Record<ExpressionId, { hold: number; cooldown: number }>> = {
  'idle-fidget': { hold: 1.6, cooldown: 9 },
  sleepy: { hold: 2.8, cooldown: 14 },
  sassy: { hold: 2.4, cooldown: 25 },
  'happy-dance': { hold: 3, cooldown: 35 },
  startled: { hold: 1, cooldown: 4 },
};
/** A doze is a held sleepy face, renewed (with the odd new yawn) while it lasts. */
const DOZE_HOLD = 9;

export class TaviLife {
  energy = 0.8;
  boredom = 0.1;
  interest = 0;
  private dozing = false;
  private legSwing = 0;
  private clock = 0;
  private decideAt = 2;
  private cue: LifeCue | null = null;
  private cueUntil = 0;
  private last: ExpressionId | null = null;
  private ready: Partial<Record<ExpressionId, number>> = {};
  private n = 0;
  private seed: number;

  constructor(seed = 7) {
    this.seed = seed;
  }

  private random() {
    this.seed = (this.seed * 1664525 + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }

  private play(id: ExpressionId, hold?: number) {
    const move = MOVES[id];
    this.n++;
    this.cue = { id, n: this.n, hold: hold ?? move?.hold ?? 2 };
    this.cueUntil = this.clock + this.cue.hold;
    this.ready[id] = this.clock + (move?.cooldown ?? 10);
    this.last = id;
    return this.cue.hold;
  }

  private can(id: ExpressionId) {
    return id !== this.last && this.clock >= (this.ready[id] ?? 0);
  }

  update(input: LifeInput): LifeFrame {
    const dt = clamp(input.dt, 0, 0.05);
    this.clock += dt;
    const resting = input.posture === 'perch' || input.posture === 'floor-sit';

    // The drives.
    this.energy = clamp(
      this.energy -
        input.exertion * dt * 0.05 -
        input.impact * 0.08 +
        (resting ? 0.02 : input.posture === 'stand' ? 0.008 : 0) * dt,
      0.12,
      1,
    );
    if (input.visitorActive) this.boredom = clamp(this.boredom - dt * 0.35);
    else if (input.posture === 'busy') this.boredom = clamp(this.boredom - dt * 0.05);
    else this.boredom = clamp(this.boredom + dt / 28);
    this.interest = approach(
      this.interest,
      input.visitorNear ? 1 : 0,
      dt * (input.visitorNear ? 1.2 : 0.1),
    );

    let pause = 0;
    if (this.cue && this.clock >= this.cueUntil) this.cue = null;

    // Waking: a dozing Tavi startles awake when the visitor does something.
    if (this.dozing && (input.visitorActive || !resting)) {
      this.dozing = false;
      this.boredom = clamp(this.boredom - 0.4);
      this.cue = null;
      if (resting && input.visitorActive) pause = this.play('startled');
      this.decideAt = this.clock + 2.5;
    } else if (this.dozing && !this.cue) this.play('sleepy', DOZE_HOLD);

    // Choosing what to do: only while still, never over another move, every few seconds.
    if (input.posture === 'busy') {
      // Moving, jumping or acting in a scene: nothing new starts, and a move in progress yields.
      this.cue = null;
      this.decideAt = Math.max(this.decideAt, this.clock + 1.2);
    } else if (!this.cue && !this.dozing && this.clock >= this.decideAt) {
      this.decideAt = this.clock + 2.5 + this.random() * 3;
      const sleepyEnough = this.energy < 0.4 || this.boredom > 0.75;
      // Sitting with nothing going on for long enough, anyone drifts off.
      if (resting && this.boredom > 0.85) {
        this.dozing = true;
        this.play('sleepy', DOZE_HOLD);
      } else if (sleepyEnough && this.boredom > 0.45 && this.can('sleepy')) {
        // A yawn and a stretch; standing, the routine waits for it.
        pause = this.play('sleepy');
        this.boredom = clamp(this.boredom - 0.15);
      } else if (
        input.posture === 'stand' &&
        input.visitorNear &&
        this.interest > 0.6 &&
        this.can('sassy')
      ) {
        // Showing off for a visitor who is right there.
        pause = this.play('sassy');
      } else if (
        input.posture === 'stand' &&
        input.roomy &&
        this.energy > 0.65 &&
        this.boredom > 0.55 &&
        this.can('happy-dance')
      ) {
        // Plenty of energy and nothing happening: she entertains herself.
        pause = this.play('happy-dance');
        this.energy -= 0.12;
        this.boredom = clamp(this.boredom - 0.5);
      } else if (this.boredom > 0.3 && this.can('idle-fidget')) {
        pause = this.play('idle-fidget');
        this.boredom = clamp(this.boredom - 0.1);
      }
    }

    // Perched with her legs over an edge, a bored Tavi swings them; lively when rested.
    const swing =
      input.posture === 'perch' && !this.dozing
        ? clamp((this.boredom - 0.2) / 0.4) * (0.45 + 0.55 * this.energy)
        : 0;
    this.legSwing = approach(this.legSwing, swing, dt / 1.5);

    return {
      energy: this.energy,
      boredom: this.boredom,
      interest: this.interest,
      cue: this.cue,
      legSwing: this.legSwing,
      dozing: this.dozing,
      pause,
    };
  }
}
