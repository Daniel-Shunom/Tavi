// Tavi's inner life: short emotions, a slower mood and two slow drives. Pure and clock-injected.
// Research and rationale: docs/BEHAVIOR-SYSTEMS.md. In short:
//  - ALMA (Gebhard 2005): emotions (seconds) feed a mood (minutes) that relaxes to a baseline
//    set by personality. Mood lives in PAD space: pleasure, arousal, dominance.
//  - Kismet (Breazeal): stimulation has a comfort zone; too little reads as boredom, too much as
//    overwhelm. Fatigue builds while awake and recovers while asleep.
//  - Petz (Stern et al.): never show meters. State is visible only through how Tavi moves.
// Everything here is deterministic rules, never AI.
import { z } from 'zod';

export type Personality = 'cozy' | 'playful' | 'shy';
export type Attitude = 'gentle' | 'cheeky' | 'spicy';

export interface Pad {
  pleasure: number;
  arousal: number;
  dominance: number;
}

/** What happened, as Tavi experiences it. Twitch, studio and timer inputs map onto these. */
export type Stimulus =
  | 'chat' // any chat message, addressed or not
  | 'addressed' // chat that names Tavi
  | 'streamer' // the streamer talked to Tavi
  | 'studio' // the streamer used a manual control
  | 'burst' // chat suddenly got busy
  | 'support-small'
  | 'support-medium'
  | 'support-large'
  | 'raid'
  | 'moderation' // a message was removed
  | 'woken'; // woken up by something

interface Appraisal extends Pad {
  /** How much the stimulus feeds Kismet-style stimulation (0..1). */
  stimulation: number;
}

/** OCC-style appraisal table: event -> emotion impulse (PAD) and stimulation. */
export const appraisals: Readonly<Record<Stimulus, Appraisal>> = {
  chat: { pleasure: 0.01, arousal: 0.015, dominance: 0, stimulation: 0.02 },
  addressed: { pleasure: 0.12, arousal: 0.12, dominance: 0.04, stimulation: 0.08 },
  streamer: { pleasure: 0.1, arousal: 0.1, dominance: 0, stimulation: 0.08 },
  studio: { pleasure: 0.05, arousal: 0.08, dominance: 0, stimulation: 0.05 },
  burst: { pleasure: 0.12, arousal: 0.3, dominance: -0.05, stimulation: 0.15 },
  'support-small': { pleasure: 0.2, arousal: 0.15, dominance: 0.05, stimulation: 0.1 },
  'support-medium': { pleasure: 0.35, arousal: 0.3, dominance: 0.1, stimulation: 0.15 },
  'support-large': { pleasure: 0.55, arousal: 0.55, dominance: 0.15, stimulation: 0.25 },
  raid: { pleasure: 0.45, arousal: 0.6, dominance: -0.1, stimulation: 0.3 },
  moderation: { pleasure: -0.15, arousal: 0.1, dominance: -0.1, stimulation: 0.02 },
  woken: { pleasure: -0.08, arousal: 0.3, dominance: -0.1, stimulation: 0.05 },
};

export const affectRules = {
  /** Emotion impulses fade with this time constant. */
  emotionTauMs: 25_000,
  /** Mood follows baseline + emotion with this time constant. */
  moodTauMs: 150_000,
  /** Stimulation fades toward zero with this time constant. */
  stimulationTauMs: 300_000,
  /** Awake for this long at neutral arousal: fully tired. */
  fatigueFullMs: 4 * 3_600_000,
  /** Asleep for this long: fully rested. */
  recoverFullMs: 25 * 60_000,
  /** Below this stimulation Tavi gets bored; above `overloadAt` she gets overwhelmed. */
  boredBelow: 0.12,
  overloadAt: 0.7,
} as const;

/** Long-term layer: personality and settings set where mood rests and how strongly it reacts. */
export function baseline(persona: {
  personality: Personality;
  attitude: Attitude;
  energy: number;
}): Pad {
  const base = {
    cozy: { pleasure: 0.2, arousal: -0.15, dominance: 0 },
    playful: { pleasure: 0.3, arousal: 0.25, dominance: 0.15 },
    shy: { pleasure: 0.1, arousal: -0.05, dominance: -0.35 },
  }[persona.personality];
  const attitude = {
    gentle: { pleasure: 0.1, dominance: -0.1 },
    cheeky: { pleasure: 0, dominance: 0.05 },
    spicy: { pleasure: -0.05, dominance: 0.2 },
  }[persona.attitude];
  const energy = (clamp(persona.energy, 0, 100) - 50) / 100;
  return {
    pleasure: clamp(base.pleasure + attitude.pleasure, -1, 1),
    arousal: clamp(base.arousal + 0.5 * energy, -1, 1),
    dominance: clamp(base.dominance + attitude.dominance, -1, 1),
  };
}

/** Per-personality gains on emotion impulses (shy startles more, playful enjoys more). */
const gains: Record<Personality, Pad> = {
  cozy: { pleasure: 1, arousal: 0.8, dominance: 1 },
  playful: { pleasure: 1.2, arousal: 1.15, dominance: 1 },
  shy: { pleasure: 0.9, arousal: 1.25, dominance: 1.2 },
};

export const affectSnapshotSchema = z
  .object({
    pleasure: z.number().min(-1).max(1),
    arousal: z.number().min(-1).max(1),
    dominance: z.number().min(-1).max(1),
    /** 0 rested .. 1 exhausted. */
    fatigue: z.number().min(0).max(1),
    /** 0 content .. 1 very bored (understimulated). */
    boredom: z.number().min(0).max(1),
    /** 0 calm .. 1 overwhelmed (overstimulated). */
    overload: z.number().min(0).max(1),
    /** Short human label for the studio, e.g. "upbeat, a bit sleepy". */
    label: z.string().max(60),
  })
  .strict();
export type AffectSnapshot = z.infer<typeof affectSnapshotSchema>;
export const neutralAffect: AffectSnapshot = {
  pleasure: 0,
  arousal: 0,
  dominance: 0,
  fatigue: 0,
  boredom: 0,
  overload: 0,
  label: 'settled',
};

export interface AffectPersona {
  personality: Personality;
  attitude: Attitude;
  energy: number;
}

/** Emotion (seconds) -> mood (minutes) -> personality baseline, plus fatigue and stimulation. */
export class Affect {
  private emotion: Pad = { pleasure: 0, arousal: 0, dominance: 0 };
  private mood: Pad;
  private stimulation = 0.3;
  private fatigue = 0;
  private updatedAt: number;
  constructor(
    now: number,
    private persona: AffectPersona,
  ) {
    this.mood = baseline(persona);
    this.updatedAt = now;
  }
  setPersona(persona: AffectPersona) {
    this.persona = persona;
  }
  /** Advances time. `asleep` recovers fatigue instead of building it. */
  step(now: number, asleep: boolean) {
    let remaining = Math.max(0, now - this.updatedAt);
    this.updatedAt = now;
    // Substeps keep emotion -> mood coupling accurate across long gaps (reconnects, tests).
    while (remaining > 0) {
      const dt = Math.min(remaining, 5000);
      remaining -= dt;
      this.advance(dt, asleep);
    }
  }
  private advance(dt: number, asleep: boolean) {
    const rules = affectRules;
    const target = baseline(this.persona);
    const fadeEmotion = Math.exp(-dt / rules.emotionTauMs);
    const k = 1 - Math.exp(-dt / rules.moodTauMs);
    for (const axis of axes) {
      this.mood[axis] = clamp(
        this.mood[axis] + (target[axis] + this.emotion[axis] - this.mood[axis]) * k,
        -1,
        1,
      );
      this.emotion[axis] *= fadeEmotion;
    }
    this.stimulation *= Math.exp(-dt / rules.stimulationTauMs);
    if (asleep) this.fatigue = Math.max(0, this.fatigue - dt / rules.recoverFullMs);
    else {
      // High arousal tires faster; a calm Tavi lasts longer.
      const rate = 1 + 0.5 * Math.max(0, this.mood.arousal);
      this.fatigue = Math.min(1, this.fatigue + (dt * rate) / rules.fatigueFullMs);
    }
  }
  /** Something happened. Impulses stack but saturate, so a flood never pins mood to an extreme. */
  feel(now: number, stimulus: Stimulus, asleep = false) {
    this.step(now, asleep);
    const appraisal = appraisals[stimulus];
    const gain = gains[this.persona.personality];
    for (const axis of axes) {
      const impulse = appraisal[axis] * gain[axis];
      // Soft saturation: the closer to the limit, the less a new impulse adds.
      const room = impulse >= 0 ? 1 - this.emotion[axis] : 1 + this.emotion[axis];
      this.emotion[axis] = clamp(this.emotion[axis] + impulse * room, -1, 1);
    }
    this.stimulation = Math.min(1.5, this.stimulation + appraisal.stimulation);
  }
  /** The visible state: mood plus what is still felt right now. Quantized so it changes rarely. */
  snapshot(): AffectSnapshot {
    const felt = (axis: keyof Pad) =>
      quantize(clamp(this.mood[axis] + 0.85 * this.emotion[axis], -1, 1));
    const rules = affectRules;
    const snapshot = {
      pleasure: felt('pleasure'),
      arousal: felt('arousal'),
      dominance: felt('dominance'),
      fatigue: quantize(this.fatigue),
      boredom: quantize(clamp(1 - this.stimulation / rules.boredBelow, 0, 1)),
      overload: quantize(
        clamp((this.stimulation - rules.overloadAt) / (1.5 - rules.overloadAt), 0, 1),
      ),
    };
    return { ...snapshot, label: describeAffect(snapshot) };
  }
  /** Tests and restores. */
  get raw() {
    return {
      emotion: { ...this.emotion },
      mood: { ...this.mood },
      stimulation: this.stimulation,
      fatigue: this.fatigue,
    };
  }
}

/** Plain-language summary for the studio (never shown on stream). */
export function describeAffect(a: Omit<AffectSnapshot, 'label'>): string {
  const parts: string[] = [];
  if (a.overload >= 0.5) parts.push('overwhelmed');
  else if (a.arousal >= 0.45) parts.push(a.pleasure >= 0.2 ? 'hyped' : 'on edge');
  else if (a.pleasure >= 0.35) parts.push('upbeat');
  else if (a.pleasure <= -0.15) parts.push('a little down');
  else if (a.arousal <= -0.3) parts.push('mellow');
  else parts.push('settled');
  if (a.boredom >= 0.6) parts.push('bored');
  if (a.fatigue >= 0.75) parts.push('very sleepy');
  else if (a.fatigue >= 0.45) parts.push('a bit sleepy');
  return parts.join(', ');
}

/**
 * How affect changes behavior timing: multiplies the quiet-time schedule (settle, doze, lie).
 * Tired or bored Tavi settles sooner; an excited one stays up longer.
 */
export function restScale(a: AffectSnapshot) {
  const awake = 1 + 0.8 * Math.max(0, a.arousal) + 0.4 * a.overload;
  const sleepy = 1 - 0.5 * a.fatigue - 0.25 * a.boredom;
  return clamp(awake * sleepy, 0.35, 2);
}

/**
 * How affect changes movement: the effective 0-100 energy the motion layer and expression
 * strength use. Arousal lifts or lowers it, fatigue drags it down. Personality settings still
 * set the base; affect only shades it ("how, not what").
 */
export function effectiveEnergy(configEnergy: number, a: AffectSnapshot | null | undefined) {
  if (!a) return configEnergy;
  return clamp(configEnergy + 30 * a.arousal - 20 * a.fatigue, 0, 100);
}

const axes = ['pleasure', 'arousal', 'dominance'] as const;
function clamp(value: number, low: number, high: number) {
  return Math.min(high, Math.max(low, value));
}
function quantize(value: number) {
  return Math.round(value * 20) / 20;
}
