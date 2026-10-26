// Provider-neutral support events. A trusted connector normalizes its event into this contract;
// the Studio uses the same details for explicitly labelled previews.
import { z } from 'zod';

export const supportTiers = ['small', 'medium', 'big'] as const;
export type SupportTier = (typeof supportTiers)[number];
export const supportSettingsSchema = z
  .object({
    enabled: z.boolean(),
    /** ISO-style currency code; amounts below are major units, never converted automatically. */
    currency: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]{3}$/),
    mediumMin: z.number().positive().max(1_000_000_000),
    bigMin: z.number().positive().max(1_000_000_000),
  })
  .strict()
  .refine((value) => value.bigMin > value.mediumMin, {
    path: ['bigMin'],
    message: 'The big reaction amount must be higher than the medium amount.',
  });
export type SupportSettings = z.infer<typeof supportSettingsSchema>;
export const defaultSupportSettings: SupportSettings = {
  enabled: true,
  currency: 'USD',
  mediumMin: 10,
  bigMin: 50,
};

const donation = z.object({
  kind: z.literal('donation'),
  amount: z.number().positive().max(1_000_000_000),
  currency: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{3}$/),
});
const subscription = z.object({
  kind: z.literal('subscription'),
  /** Reaction size assigned by the connector, not an assumption about a provider's plan IDs. */
  tier: z.enum(supportTiers),
});
export const supportPreviewSchema = z.discriminatedUnion('kind', [
  donation.strict(),
  subscription.strict(),
]);
export type SupportPreview = z.infer<typeof supportPreviewSchema>;
const envelope = {
  id: z.string().min(1).max(64),
  provider: z.string().regex(/^[a-z0-9-]{1,32}$/),
  /** Time of the original event, in service-clock milliseconds. */
  receivedAt: z.number(),
};
export const supportEventSchema = z.discriminatedUnion('kind', [
  donation.extend(envelope).strict(),
  subscription.extend(envelope).strict(),
]);
export type SupportEvent = z.infer<typeof supportEventSchema>;

/** null means the currency cannot be interpreted using the streamer's chosen thresholds. */
export function supportTier(event: SupportPreview, settings: SupportSettings): SupportTier | null {
  if (event.kind === 'subscription') return event.tier;
  if (event.currency !== settings.currency) return null;
  return event.amount >= settings.bigMin
    ? 'big'
    : event.amount >= settings.mediumMin
      ? 'medium'
      : 'small';
}
