// Twitch stream events Tavi reacts to (follows, raids, subs, gifts, cheers, hype trains and
// channel-point redemptions). Read-only: Tavi never posts or changes anything on the channel.
// Reactions are deterministic rules (server/behavior/streamEvents.ts), never AI.
import { z } from 'zod';

const name = z.string().trim().min(1).max(100);
/** Channel-point mischief a reward can be mapped to (by reward title keywords). */
export const mischiefIds = ['poke', 'dance', 'snack', 'wave', 'nap'] as const;
export type Mischief = (typeof mischiefIds)[number];

export const streamEventBodySchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('follow'), user: name }).strict(),
  z.object({ kind: z.literal('raid'), from: name, viewers: z.number().int().min(0) }).strict(),
  z
    .object({
      kind: z.literal('subscription'),
      user: name,
      tier: z.enum(['1000', '2000', '3000']),
      gifted: z.boolean(),
    })
    .strict(),
  z
    .object({
      kind: z.literal('gift'),
      user: name.nullable(),
      count: z.number().int().min(1).max(1000),
    })
    .strict(),
  z
    .object({ kind: z.literal('cheer'), user: name.nullable(), bits: z.number().int().min(1) })
    .strict(),
  z
    .object({
      kind: z.literal('hype-train'),
      phase: z.enum(['begin', 'progress', 'end']),
      level: z.number().int().min(1).max(100),
    })
    .strict(),
  z
    .object({
      kind: z.literal('redemption'),
      user: name,
      reward: z.string().trim().max(100),
      mischief: z.enum(mischiefIds).nullable(),
    })
    .strict(),
]);
export type StreamEventBody = z.infer<typeof streamEventBodySchema>;
export type StreamEventKind = StreamEventBody['kind'];

const envelope = z.object({
  id: z.string().min(1).max(100),
  /** Service-clock ms when the event arrived. */
  receivedAt: z.number(),
});
export const streamEventSchema = z.intersection(streamEventBodySchema, envelope);
export type StreamEvent = StreamEventBody & z.infer<typeof envelope>;

/**
 * Maps a channel-point reward title to mischief by keyword, so streamers can name rewards
 * naturally ("Poke Tavi", "Make Tavi dance", "Feed Tavi a snack"). Unknown rewards get a small
 * acknowledgement instead.
 */
export function mischiefFor(rewardTitle: string): Mischief | null {
  const title = rewardTitle.toLowerCase();
  if (/\b(poke|boop|bonk|tickle)\b/.test(title)) return 'poke';
  if (/\b(dance|boogie|groove)\b/.test(title)) return 'dance';
  if (/\b(snack|feed|cookie|treat|food)\b/.test(title)) return 'snack';
  if (/\b(wave|hello|hi|greet)\b/.test(title)) return 'wave';
  if (/\b(nap|sleep|bedtime|rest)\b/.test(title)) return 'nap';
  return null;
}
