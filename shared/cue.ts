// Performance cue contract shared by the service, studio and overlay.
// An ExpressionScript is a short list of timed beats with explicit priority, expiry and provenance.
// Times inside a script are absolute service-clock milliseconds (startAt/expiresAt) plus beat
// offsets in seconds, so every client renders the same moment and a reconnect never replays.
import { z } from 'zod';
import {
  clampIntensity,
  expressionIdSchema,
  expressions,
  sequences,
  targetSchema,
  type ExpressionId,
  type SequenceId,
  type Target,
} from './expressions.js';

/** Streamer controls > manual studio cues > streamer conversation > chat > idle. */
export const priorities = { idle: 0, chat: 1, streamer: 2, manual: 3, control: 4 } as const;
export type PriorityName = keyof typeof priorities;

export const beatSchema = z
  .object({
    expression: expressionIdSchema,
    intensity: z.number().min(0).max(1),
    target: targetSchema,
    caption: z.string().trim().max(60).optional(),
    /** Seconds after script start. */
    offset: z.number().min(0).max(20),
    /** Readable hold in seconds (anticipation and recovery come from the character). */
    hold: z.number().min(0.2).max(12),
    /** Beats sharing a group cancel each other; defaults to the expression's channel. */
    group: z.string().max(24).optional(),
  })
  .strict();
export type Beat = z.infer<typeof beatSchema>;

export const decisionMakers = ['manual', 'rules', 'ai', 'local'] as const;
export const decidedBySchema = z
  .object({
    kind: z.enum(decisionMakers),
    /** Human-readable, e.g. "Rules (not AI)" or "OpenAI-compatible: gpt-x". */
    label: z.string().max(80),
  })
  .strict();
export type DecidedBy = z.infer<typeof decidedBySchema>;

export const droppedSchema = z
  .object({ expression: z.string().max(40), reason: z.string().max(120) })
  .strict();

export const scriptSchema = z
  .object({
    id: z.string().max(64),
    sourceEventId: z.string().max(64),
    source: z.enum(['manual', 'streamer', 'chat', 'event', 'idle']),
    decidedBy: decidedBySchema,
    priority: z.number().int().min(0).max(4),
    startAt: z.number(),
    /** A script that has not started by this time is discarded rather than played late. */
    expiresAt: z.number(),
    beats: z.array(beatSchema).max(8),
    /** Return to idle after the last beat. Open-ended scripts (listening, thinking) hold. */
    settle: z.boolean(),
    dropped: z.array(droppedSchema).max(8).default([]),
  })
  .strict();
export type ExpressionScript = z.infer<typeof scriptSchema>;

/** Default anticipation and recovery when a character binding does not specify its own. */
export const defaultPhases = { anticipation: 0.3, recovery: 0.5 };

export function scriptDuration(script: Pick<ExpressionScript, 'beats'>) {
  return script.beats.reduce(
    (end, beat) =>
      Math.max(end, beat.offset + defaultPhases.anticipation + beat.hold + defaultPhases.recovery),
    0,
  );
}
export function scriptEndsAt(script: ExpressionScript) {
  return script.settle ? script.startAt + scriptDuration(script) * 1000 : Infinity;
}
export function isScriptActive(script: ExpressionScript | null, now: number) {
  return !!script && now >= script.startAt - 50 && now < scriptEndsAt(script);
}

export function beat(
  expression: ExpressionId,
  options: Partial<Omit<Beat, 'expression'>> = {},
): Beat {
  const value: Beat = {
    expression,
    intensity: clampIntensity(expression, options.intensity),
    target: options.target ?? 'neutral',
    offset: options.offset ?? 0,
    hold: options.hold ?? expressions[expression].duration,
  };
  if (options.caption) value.caption = options.caption;
  if (options.group) value.group = options.group;
  return value;
}
export function expandSequence(
  id: SequenceId,
  options: { target?: Target; caption?: string; intensity?: number; offset?: number } = {},
): Beat[] {
  const steps = sequences[id].steps;
  return steps.map((step, index) =>
    beat(step.expression, {
      offset: (options.offset ?? 0) + step.offset,
      hold: step.hold,
      intensity:
        (step.intensity ?? expressions[step.expression].intensity.default) *
        (options.intensity === undefined ? 1 : 0.5 + options.intensity / 2),
      target: options.target ?? 'neutral',
      ...(index === 0 && options.caption ? { caption: options.caption } : {}),
    }),
  );
}
