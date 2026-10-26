// The structured decision a DecisionProvider (AI or rules) returns. Generated from the expression
// library and narrowed to what the active character can perform.
import { z } from 'zod';
import {
  performableExpressions,
  supportedSequences,
  type CharacterCapabilities,
} from './capabilities.js';
import {
  expressionIds,
  sequenceIds,
  targets,
  type ExpressionId,
  type SequenceId,
} from './expressions.js';
import { anchorIds, gaits } from './locomotion.js';

export interface DecisionBeat {
  expression: ExpressionId;
  intensity: number;
  target: (typeof targets)[number];
  caption: string;
  offset: number;
  hold: number;
}
export interface Decision {
  react: boolean;
  reason: string;
  sequence: SequenceId | null;
  /** Caption and target applied to a chosen sequence. */
  caption: string;
  target: (typeof targets)[number];
  beats: DecisionBeat[];
  move: {
    kind: 'move-to' | 'perch' | 'wander';
    anchor: (typeof anchorIds)[number] | null;
    gait: (typeof gaits)[number] | null;
  } | null;
}
const clamp = (min: number, max: number, fallback: number) =>
  z
    .number()
    .catch(fallback)
    .transform((value) => Math.min(max, Math.max(min, value)));

/** Lenient-on-numbers, strict-on-vocabulary validator for provider output. */
export function decisionSchema(character?: CharacterCapabilities) {
  const allowed = character ? performableExpressions(character) : expressionIds;
  const allowedSequences = character ? supportedSequences(character) : sequenceIds;
  const expression = z.enum(
    allowed.length ? (allowed as [ExpressionId, ...ExpressionId[]]) : expressionIds,
  );
  const sequence = allowedSequences.length
    ? z.enum(allowedSequences as [SequenceId, ...SequenceId[]]).nullable()
    : z.null();
  return z
    .object({
      react: z.boolean(),
      reason: z
        .string()
        .max(400)
        .catch('')
        .transform((value) => value.slice(0, 160)),
      sequence: sequence.optional().transform((value) => value ?? null),
      caption: z
        .string()
        .optional()
        .catch('')
        .transform((value) => (value ?? '').replace(/\s+/g, ' ').trim().slice(0, 60)),
      target: z.enum(targets).catch('neutral').default('neutral'),
      beats: z
        .array(
          z.object({
            expression,
            intensity: clamp(0, 1, 0.5),
            target: z.enum(targets).catch('neutral'),
            caption: z
              .string()
              .catch('')
              .transform((value) => value.replace(/\s+/g, ' ').trim().slice(0, 60)),
            offset: clamp(0, 8, 0),
            hold: clamp(0.4, 6, 1.8),
          }),
        )
        .max(6)
        .default([]),
      move: z
        .object({
          kind: z.enum(['move-to', 'perch', 'wander']),
          anchor: z.enum(anchorIds).nullable().catch(null),
          gait: z.enum(gaits).nullable().catch(null),
        })
        .nullable()
        .optional()
        .transform((value) => value ?? null),
    })
    .refine(
      (value) =>
        !value.react || value.beats.length > 0 || value.sequence !== null || value.move !== null,
      {
        message: 'A reaction needs at least one beat, a sequence or a move.',
      },
    );
}

/**
 * JSON Schema for providers' structured-output modes. Kept deliberately simple (no numeric
 * bounds, every property required, nullable via type unions) so OpenAI strict mode, Anthropic
 * structured outputs and local servers all accept it. Zod re-validates and clamps afterwards.
 */
export function decisionJsonSchema(character: CharacterCapabilities) {
  const allowed = performableExpressions(character);
  const allowedSequences = supportedSequences(character);
  return {
    type: 'object',
    additionalProperties: false,
    required: ['react', 'reason', 'sequence', 'caption', 'target', 'beats', 'move'],
    properties: {
      react: { type: 'boolean', description: 'false means deliberately no reaction.' },
      reason: { type: 'string', description: 'One short internal sentence explaining the choice.' },
      sequence: {
        type: ['string', 'null'],
        enum: [...allowedSequences, null],
        description: 'Optional ready-made sequence id. Use null when giving beats instead.',
      },
      caption: {
        type: 'string',
        description: 'Caption for the sequence, max 60 characters, or "".',
      },
      target: {
        type: 'string',
        enum: [...character.targets],
        description: 'Who the sequence is aimed at.',
      },
      beats: {
        type: 'array',
        description: 'Timed expressions, at most 6. Empty if using a sequence or not reacting.',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['expression', 'intensity', 'target', 'caption', 'offset', 'hold'],
          properties: {
            expression: { type: 'string', enum: allowed },
            intensity: { type: 'number', description: '0 to 1.' },
            target: { type: 'string', enum: [...character.targets] },
            caption: {
              type: 'string',
              description: 'Optional in-character line, max 60 characters, or "".',
            },
            offset: { type: 'number', description: 'Seconds after the reaction starts, 0 to 8.' },
            hold: { type: 'number', description: 'Seconds to hold, 0.4 to 6.' },
          },
        },
      },
      move: {
        type: ['object', 'null'],
        description: 'Optional short walk. Usually null.',
        additionalProperties: false,
        required: ['kind', 'anchor', 'gait'],
        properties: {
          kind: { type: 'string', enum: ['move-to', 'perch', 'wander'] },
          anchor: { type: ['string', 'null'], enum: [...anchorIds, null] },
          gait: { type: ['string', 'null'], enum: [...gaits, null] },
        },
      },
    },
  } as const;
}
