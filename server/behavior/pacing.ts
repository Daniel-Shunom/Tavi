// Pacing director (after Left 4 Dead's AI Director): an intensity budget that rises with each
// automatic reaction and fades over time. After a peak Tavi relaxes for a while, so a busy stream
// gets a few strong moments instead of nonstop reactions, and she never upstages the streamer.
// Manual, streamer and control cues are never limited. Pure and clock-injected.

export type PacingPhase = 'build' | 'peak' | 'relax';

export const pacingRules = {
  /** Intensity fades with this time constant. */
  tauMs: 75_000,
  /** At or above this, the next automatic reaction ends the peak and starts a relax window. */
  peakAt: 1,
  /** Relax lasts at least this long and until intensity falls below `relaxUntil`. */
  relaxMinMs: 45_000,
  relaxUntil: 0.35,
  /** While relaxing, automatic reactions play at this fraction of their intensity. */
  relaxIntensity: 0.55,
  /** Cost per reaction size. */
  cost: { small: 0.2, medium: 0.4, large: 0.7 },
} as const;

export type ReactionSize = keyof typeof pacingRules.cost;

export class PacingDirector {
  private intensity = 0;
  private updatedAt: number;
  private relaxSince: number | null = null;
  constructor(now: number) {
    this.updatedAt = now;
  }
  private update(now: number) {
    const dt = Math.max(0, now - this.updatedAt);
    this.updatedAt = now;
    this.intensity *= Math.exp(-dt / pacingRules.tauMs);
    if (
      this.relaxSince !== null &&
      now - this.relaxSince >= pacingRules.relaxMinMs &&
      this.intensity < pacingRules.relaxUntil
    )
      this.relaxSince = null;
  }
  phase(now: number): PacingPhase {
    this.update(now);
    if (this.relaxSince !== null) return 'relax';
    return this.intensity >= pacingRules.peakAt * 0.6 ? 'peak' : 'build';
  }
  level(now: number) {
    this.update(now);
    return this.intensity;
  }
  /**
   * Records an automatic reaction and returns the intensity scale to play it at
   * (1 normally, lower while relaxing). Big moments still land, just softer.
   */
  react(now: number, size: ReactionSize): number {
    const phase = this.phase(now);
    this.intensity += pacingRules.cost[size];
    if (phase !== 'relax' && this.intensity >= pacingRules.peakAt) this.relaxSince = now;
    return phase === 'relax' ? pacingRules.relaxIntensity : 1;
  }
  /** Ambient initiative (peeks, settling, wandering) waits while relaxing or peaking. */
  allowsInitiative(now: number) {
    return this.phase(now) === 'build';
  }
}
