// Decides WHEN small idle behaviours happen (glances, fidgets). HOW they move is the character
// binding plus any registered motion layer. Deterministic for a given seed.
import { expressions, type ExpressionId } from '../../shared/expressions';
import type { ActiveLayer } from './timeline';
import { smooth } from './timeline';

const idleIds = (Object.keys(expressions) as ExpressionId[]).filter(
  (id) => expressions[id].channel === 'idle',
);
export interface IdleOptions {
  /** Expressions the active character can perform. */
  supported: readonly ExpressionId[];
  seed?: number;
  /** Seconds between idle behaviours. */
  minGap?: number;
  maxGap?: number;
}
export class IdleScheduler {
  private state: number;
  private nextAt: number;
  private active: { id: ExpressionId; start: number } | null = null;
  private last: ExpressionId | null = null;
  private readonly choices: ExpressionId[];
  private readonly minGap: number;
  private readonly maxGap: number;
  constructor(options: IdleOptions) {
    this.state = options.seed ?? 1;
    this.minGap = options.minGap ?? 6;
    this.maxGap = options.maxGap ?? 14;
    this.choices = idleIds.filter((id) => options.supported.includes(id));
    this.nextAt = this.gap();
  }
  private random() {
    this.state = (this.state * 1664525 + 1013904223) >>> 0;
    return this.state / 2 ** 32;
  }
  private gap() {
    return this.minGap + (this.maxGap - this.minGap) * this.random();
  }
  /** `busy` (an active script) or `suppressed` (quiet, tucked, reduced motion) defers idle life. */
  sample(time: number, busy: boolean, suppressed: boolean): ActiveLayer[] {
    if (suppressed || busy) {
      this.active = null;
      if (this.nextAt < time + this.minGap / 2) this.nextAt = time + this.gap();
      return [];
    }
    if (!this.active && time >= this.nextAt && this.choices.length) {
      const options =
        this.choices.length > 1 ? this.choices.filter((id) => id !== this.last) : this.choices;
      const id = options[Math.floor(this.random() * options.length)] ?? this.choices[0];
      if (id) {
        this.active = { id, start: time };
        this.last = id;
      }
    }
    if (!this.active) return [];
    const definition = expressions[this.active.id];
    const elapsed = time - this.active.start;
    const rise = 0.5,
      fall = 0.7;
    const total = rise + definition.duration + fall;
    if (elapsed >= total) {
      this.active = null;
      this.nextAt = time + this.gap();
      return [];
    }
    const weight =
      elapsed < rise
        ? smooth(elapsed / rise)
        : elapsed > rise + definition.duration
          ? 1 - smooth((elapsed - rise - definition.duration) / fall)
          : 1;
    return [
      {
        expression: this.active.id,
        channel: 'idle',
        intensity: definition.intensity.default,
        target: 'neutral',
        phase:
          elapsed < rise
            ? 'anticipation'
            : elapsed > rise + definition.duration
              ? 'recovery'
              : 'hold',
        progress: 0,
        weight,
        elapsed,
        span: rise + definition.duration,
        group: 'idle',
      },
    ];
  }
}
