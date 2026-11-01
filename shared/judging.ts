import { z } from 'zod';

export const JUDGING_DURATION_MS = 30 * 60_000;
export const JUDGING_WARNING_MS = 5 * 60_000;
export const JUDGING_EXTENSION_MS = 15 * 60_000;

export const judgingSessionSchema = z.object({
  id: z.string(),
  createdAt: z.number(),
  expiresAt: z.number(),
  serverNow: z.number(),
  canExtend: z.boolean(),
  epoch: z.number().int().nonnegative(),
  role: z.enum(['controller', 'viewer']),
  overlayUrl: z.url(),
  lastTestEvent: z.object({ label: z.string(), at: z.number() }).nullable(),
});
export type JudgingSession = z.infer<typeof judgingSessionSchema>;

export const judgingTestEvents = ['chat', 'raid', 'gift', 'bits'] as const;
export type JudgingTestEvent = (typeof judgingTestEvents)[number];
