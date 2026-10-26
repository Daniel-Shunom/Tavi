// Public, non-secret AI provider status shared by the service and the studio.
import { z } from 'zod';

export const providerIds = ['rules', 'openai', 'anthropic'] as const;
const providerInfo = z.object({
  id: z.string(),
  kind: z.enum(['rules', 'ai']),
  label: z.string(),
  model: z.string().optional(),
});
export const aiStatusSchema = z.object({
  active: providerInfo,
  providers: z.array(
    z.object({
      id: z.enum(providerIds),
      label: z.string(),
      configured: z.boolean(),
      model: z.string().optional(),
      baseUrl: z.string().optional(),
      hint: z.string().optional(),
    }),
  ),
  calls: z.number(),
  budget: z.object({ perMinute: z.number(), perSession: z.number(), remainingSession: z.number() }),
  last: z
    .object({
      by: providerInfo,
      latencyMs: z.number(),
      outcome: z.enum(['reaction', 'no-reaction', 'fallback']),
      error: z.string().optional(),
      at: z.number(),
    })
    .nullable(),
});
export type AiStatus = z.infer<typeof aiStatusSchema>;
export const selectionSchema = z
  .object({
    provider: z.enum(providerIds),
    model: z
      .string()
      .trim()
      .min(1)
      .max(120)
      .regex(/^[\w.:/@-]+$/)
      .optional(),
    baseUrl: z.url().max(200).optional(),
  })
  .strict();
export type Selection = z.infer<typeof selectionSchema>;
