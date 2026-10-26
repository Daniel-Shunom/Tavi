# Support-event reactions

Donation and subscription reactions use deterministic rules with three sizes: small, medium,
and big. They target the configured chat region. Small and medium reactions use a warm
thank-you gesture; big reactions add a brief happy dance when Tavi is standing. A seated
character uses an upper-body thank-you instead of moving its feet.

The Studio playground contains clearly labelled simulated previews and saved reaction settings.
Donation defaults are USD, medium from 10, big from 50, with smaller positive amounts using
small reactions. All amounts are major currency units (for example, dollars rather than cents).
The currency and both thresholds are editable. Mismatching currencies are skipped; Tavi does
not perform an exchange-rate conversion. Subscription reaction size is explicitly normalized by
the connector, rather than assuming every provider uses the same subscription plan IDs.

## Live integration boundary

`Companion.supportEvent` accepts the validated `shared/support.ts` contract from trusted service
adapters. Events carry a provider, a provider event ID, their original receipt timestamp, and
donation or subscription details. This milestone does not install a live donation or subscription
connector. Twitch remains read-only chat with `user:read:chat`; simulated previews do not claim
that Twitch, a payment service, or an AI provider produced the event.

Future adapters must validate provider authenticity before calling this boundary, map provider
timestamps to the service clock, preserve IDs for deduplication, and explicitly normalize
subscription reaction tiers. Do not accept arbitrary unauthenticated HTTP posts as live donations.

## Interruption and burst behavior

Support reactions yield to manual cues, streamer input, pending decisions, and existing event/chat
reactions. Quiet mode, tuck away, or disabling support reactions suppresses them. The service
discards events older than 15 seconds or more than 5 seconds in the future, remembers the most
recent 256 provider/event IDs, and enforces an eight-second cooldown. Suppressed events are
remembered and never queued for replay when quiet mode ends. Stop clears the active cue.

The new animations are also available through the ordinary expression gallery. The manually
requested blocked-perch response uses `perch-hesitate` when there is no eligible webcam ledge;
it does not invent a ledge, body state, or walking destination.
