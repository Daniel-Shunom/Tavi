// Affect snapshot contract shared by the service, Studio and renderer.
import { z } from 'zod';

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

/**
 * How affect changes movement: the effective 0-100 energy the motion layer and expression
 * strength use. Arousal lifts or lowers it, fatigue drags it down. Personality settings still
 * set the base; affect only shades it ("how, not what").
 */
export function effectiveEnergy(configEnergy: number, a: AffectSnapshot | null | undefined) {
  if (!a) return configEnergy;
  return clamp(configEnergy + 30 * a.arousal - 20 * a.fatigue, 0, 100);
}

function clamp(value: number, low: number, high: number) {
  return Math.min(high, Math.max(low, value));
}
