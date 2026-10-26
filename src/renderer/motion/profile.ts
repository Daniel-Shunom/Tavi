// Personality / attitude / energy -> concrete motion parameters.
// Rationale and sources: docs/motion/RESEARCH.md ("Personality to motion"). In short:
//  - Laban/EMOTE effort: Time (sudden vs sustained) -> spring frequency and tempo;
//    Weight (light vs strong) -> overshoot and landing heaviness; Flow (free vs bound) -> damping.
//  - Neff et al. 2010: extraversion = larger, faster, more frequent movement, more posture shifts;
//    introversion = smaller (scale 0.5-0.6), slower, longer response latency, gaze aversion.
//  - Live2D defaults: blink every ~3.5 s, breath cycle ~3.2 s; human rest 12-20 breaths/min.
import type { SecondOrderParams } from './core/spring';
import type { MotionSettings, Personality } from './types';

export interface MotionProfile {
  /** Multiplier on speeds and reaction tempo (1 = neutral). */
  tempo: number;
  /** Multiplier on gesture amplitude. */
  amplitude: number;
  /** Idle sway/noise amplitude multiplier. */
  idleAmplitude: number;
  head: SecondOrderParams;
  body: SecondOrderParams;
  hair: SecondOrderParams;
  gaze: SecondOrderParams;
  /** Peak above full intensity at the end of a reaction's attack. */
  overshoot: number;
  /** Anticipation length multiplier (cheeky/spicy wind up more). */
  anticipation: number;
  /** Seconds between a cue and the visible start of a reaction. */
  reactionLatency: number;
  breathPeriod: number;
  breathAmount: number;
  /** Mean seconds between spontaneous blinks. */
  blinkMean: number;
  doubleBlinkChance: number;
  /** Mean fixation hold in seconds while idle. */
  gazeHoldMean: number;
  /** 0..1 tendency to look away from the attention target. */
  gazeAwayBias: number;
  /** Mean seconds between idle fidgets (Infinity disables initiative). */
  fidgetMean: number;
  fidgetWeights: Readonly<Record<string, number>>;
  /** Whether the character may travel across the stage (false: fade/short slide instead). */
  travel: boolean;
  maxSquash: number;
  /** Preferred locomotion style for medium/long moves. */
  gait: 'amble' | 'step' | 'hop' | 'scoot';
  /** Entrance weights by choreography id. */
  entranceWeights: Readonly<Record<string, number>>;
}

const personalities: Record<
  Personality,
  Omit<MotionProfile, 'head' | 'body' | 'hair' | 'gaze' | 'travel' | 'maxSquash'> & {
    zeta: number;
    f: number;
  }
> = {
  cozy: {
    tempo: 0.85,
    amplitude: 0.85,
    idleAmplitude: 0.9,
    zeta: 0.85,
    f: 1.4,
    overshoot: 0.08,
    anticipation: 0.8,
    reactionLatency: 0.25,
    breathPeriod: 4.6,
    breathAmount: 1,
    blinkMean: 4.2,
    doubleBlinkChance: 0.08,
    gazeHoldMean: 3.6,
    gazeAwayBias: 0.3,
    fidgetMean: 14,
    fidgetWeights: {
      sigh: 3,
      weightShift: 3,
      stretch: 2,
      glance: 2,
      hairFlick: 1,
      lookAround: 1,
      footTap: 0.5,
      smallSmile: 2,
    },
    gait: 'amble',
    entranceWeights: { tiredWalk: 5, drop: 1.5, climb: 1.5 },
  },
  playful: {
    tempo: 1.2,
    amplitude: 1.2,
    idleAmplitude: 1.15,
    zeta: 0.45,
    f: 2.2,
    overshoot: 0.22,
    anticipation: 1.1,
    reactionLatency: 0.12,
    breathPeriod: 3.2,
    breathAmount: 1.1,
    blinkMean: 3.2,
    doubleBlinkChance: 0.14,
    gazeHoldMean: 2.2,
    gazeAwayBias: 0.35,
    fidgetMean: 8,
    fidgetWeights: {
      glance: 3,
      lookAround: 3,
      footTap: 2,
      hairFlick: 2,
      weightShift: 2,
      smallSmile: 2,
      stretch: 1,
      sigh: 0.5,
    },
    gait: 'hop',
    entranceWeights: { drop: 5, tiredWalk: 1, climb: 2 },
  },
  shy: {
    tempo: 0.9,
    amplitude: 0.65,
    idleAmplitude: 0.8,
    zeta: 0.8,
    f: 1.6,
    overshoot: 0.06,
    anticipation: 0.7,
    reactionLatency: 0.4,
    breathPeriod: 3.9,
    breathAmount: 0.9,
    blinkMean: 2.8,
    doubleBlinkChance: 0.18,
    gazeHoldMean: 1.6,
    gazeAwayBias: 0.65,
    fidgetMean: 11,
    fidgetWeights: {
      hairFlick: 3,
      glance: 3,
      weightShift: 2,
      smallSmile: 1,
      sigh: 1,
      lookAround: 0.5,
      footTap: 1,
      stretch: 0.3,
    },
    gait: 'scoot',
    entranceWeights: { climb: 5, tiredWalk: 1.5, drop: 0.5 },
  },
};

export function motionProfile(settings: MotionSettings): MotionProfile {
  const p = personalities[settings.personality];
  const energy = Math.max(0, Math.min(100, settings.energy)) / 100;
  // Energy: tempo 0.75-1.25x, amplitude 0.6-1.3x, fidget rate 0.5-1.6x (heuristic, see research).
  const energyTempo = 0.75 + 0.5 * energy;
  const energyAmp = 0.6 + 0.7 * energy;
  const energyFidget = 0.5 + 1.1 * energy;
  const attitude = {
    gentle: { r: 0, fScale: 0.9, overshoot: 0.7, zeta: 1.1, anticipation: 0.8 },
    cheeky: { r: -0.35, fScale: 1, overshoot: 1, zeta: 1, anticipation: 1.15 },
    spicy: { r: -0.5, fScale: 1.25, overshoot: 1.35, zeta: 0.85, anticipation: 1.3 },
  }[settings.attitude];
  const zeta = Math.min(1.2, p.zeta * attitude.zeta);
  const f = p.f * attitude.fScale * (0.85 + 0.3 * energy);
  let profile: MotionProfile = {
    tempo: p.tempo * energyTempo,
    amplitude: p.amplitude * energyAmp,
    idleAmplitude: p.idleAmplitude * (0.75 + 0.5 * energy),
    head: { f, zeta, r: attitude.r },
    body: { f: f * 0.6, zeta: Math.min(1.2, zeta + 0.2), r: 0 },
    // Well damped (no ringing): hair lags and settles, it never wobbles on its own.
    hair: { f: 1.8 + 0.6 * energy, zeta: 0.85, r: 0 },
    gaze: { f: 5, zeta: 0.9, r: 0 },
    overshoot: p.overshoot * attitude.overshoot,
    anticipation: p.anticipation * attitude.anticipation,
    reactionLatency: p.reactionLatency,
    breathPeriod: p.breathPeriod * (1.15 - 0.3 * energy),
    breathAmount: p.breathAmount,
    blinkMean: p.blinkMean,
    doubleBlinkChance: p.doubleBlinkChance,
    gazeHoldMean: p.gazeHoldMean / (0.8 + 0.4 * energy),
    gazeAwayBias: p.gazeAwayBias,
    fidgetMean: p.fidgetMean / energyFidget,
    fidgetWeights: p.fidgetWeights,
    travel: true,
    maxSquash: 1,
    gait: p.gait,
    entranceWeights: p.entranceWeights,
  };
  if (settings.quiet)
    profile = {
      ...profile,
      fidgetMean: Infinity,
      amplitude: profile.amplitude * 0.6,
      idleAmplitude: profile.idleAmplitude * 0.6,
    };
  if (settings.reducedMotion)
    profile = {
      ...profile,
      travel: false,
      maxSquash: 0.1,
      amplitude: Math.min(0.5, profile.amplitude * 0.5),
      idleAmplitude: profile.idleAmplitude * 0.35,
      overshoot: 0,
      anticipation: 0,
      breathAmount: profile.breathAmount * 0.5,
      head: { ...profile.head, zeta: 1, r: 0 },
      body: { ...profile.body, zeta: 1, r: 0 },
      hair: { ...profile.hair, zeta: 0.9 },
    };
  return profile;
}
