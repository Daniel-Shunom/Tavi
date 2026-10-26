// What a loaded character can actually perform, derived from its manifest. Shared by the service
// (to negotiate scripts and brief the AI) and the studio (to offer only supported controls).
import { z } from 'zod';
import {
  expressionIds,
  expressions,
  sequenceIds,
  sequences,
  targets,
  type ExpressionId,
  type SequenceId,
  type Target,
} from './expressions.js';
import type { Beat } from './cue.js';

export interface AppearanceSlot {
  label: string;
  default: string;
  options: { id: string; label: string }[];
}
export interface CharacterCapabilities {
  id: string;
  name: string;
  credit: string;
  creditUrl: string;
  /** Expressions with an authored or composed binding. */
  expressions: ExpressionId[];
  /** Manifest-declared substitutes; null means "drop deliberately". */
  fallbacks: Partial<Record<ExpressionId, ExpressionId | null>>;
  /** Attention targets the character can visibly orient toward. */
  targets: Target[];
  /** "clip": authored walk cycle; "procedural": motion layer synthesizes steps. */
  locomotion: 'procedural' | 'clip';
  appearance: Record<string, AppearanceSlot>;
}
export type CharacterCatalog = Record<string, CharacterCapabilities>;

export interface Resolution {
  beats: Beat[];
  dropped: { expression: string; reason: string }[];
  substituted: { from: ExpressionId; to: ExpressionId }[];
}
/** The expression a character will actually play for a requested one, or null with a reason. */
export function resolveExpression(
  id: ExpressionId,
  character: CharacterCapabilities,
): { id: ExpressionId; via?: 'fallback' | 'similar' } | { id: null; reason: string } {
  if (character.expressions.includes(id)) return { id };
  if (Object.hasOwn(character.fallbacks, id)) {
    const fallback = character.fallbacks[id];
    if (fallback === null || fallback === undefined)
      return { id: null, reason: `${character.name} cannot perform ${id}` };
    if (character.expressions.includes(fallback)) return { id: fallback, via: 'fallback' };
  }
  for (const similar of expressions[id].similar)
    if (character.expressions.includes(similar)) return { id: similar, via: 'similar' };
  return { id: null, reason: `${character.name} has no ${id} or similar expression` };
}
export function resolveBeats(beats: Beat[], character: CharacterCapabilities): Resolution {
  const result: Resolution = { beats: [], dropped: [], substituted: [] };
  for (const beat of beats) {
    const resolved = resolveExpression(beat.expression, character);
    if (resolved.id === null) {
      result.dropped.push({ expression: beat.expression, reason: resolved.reason });
      continue;
    }
    if (resolved.id !== beat.expression)
      result.substituted.push({ from: beat.expression, to: resolved.id });
    const target = character.targets.includes(beat.target) ? beat.target : 'neutral';
    result.beats.push({ ...beat, expression: resolved.id, target });
  }
  return result;
}
export function supportedSequences(character: CharacterCapabilities): SequenceId[] {
  return sequenceIds.filter((id) =>
    sequences[id].steps.every((step) => character.expressions.includes(step.expression)),
  );
}
/** Expressions the AI may choose for this character: selectable and natively supported. */
export function performableExpressions(character: CharacterCapabilities): ExpressionId[] {
  return expressionIds.filter(
    (id) => expressions[id].selectable && character.expressions.includes(id),
  );
}

export const capabilitiesSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]{1,32}$/),
  name: z.string().min(1),
  credit: z.string(),
  creditUrl: z.string(),
  expressions: z.array(z.enum(expressionIds)),
  fallbacks: z.record(z.string(), z.enum(expressionIds).nullable()),
  targets: z.array(z.enum(targets)),
  locomotion: z.enum(['procedural', 'clip']),
  appearance: z.record(
    z.string(),
    z.object({
      label: z.string(),
      default: z.string(),
      options: z.array(z.object({ id: z.string(), label: z.string() })).min(1),
    }),
  ),
});
