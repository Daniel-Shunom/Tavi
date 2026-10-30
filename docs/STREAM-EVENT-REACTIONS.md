# Stream event reactions

> Integration status: this is a development handoff for work outside the current main revision. Its implementation is not included in this revision; use it as development evidence, not as a claim that these controls are available here.

Tavi subscribes to real incoming Twitch raids, new subscriptions, gift-subscription bundles and Cheers. Busy chat reuses the existing distinct-chatter burst detector; it adds a short glance/content expression to its peek rather than creating a second detector. These are deterministic rules, independent of the AI provider.

| Event                     | Reaction                                           | Minimum time between reactions of this kind                |
| ------------------------- | -------------------------------------------------- | ---------------------------------------------------------- |
| Incoming raid             | Startle, wave to chat, welcome                     | 120 seconds                                                |
| Gift bundle               | Small thanks; medium at 5; large at 10 gifts       | 90 seconds                                                 |
| Cheer                     | Small thanks; medium at 1,000; large at 5,000 Bits | 60 seconds                                                 |
| New non-gift subscription | Welcome and thanks                                 | 60 seconds                                                 |
| Busy chat                 | Existing peek plus glance/content                  | Existing initiative cooldown: 3–15 minutes, maximum 6/hour |

All live event expressions also share a 30-second cooldown. No backlog is queued: skipped events stay skipped after quiet mode, tuck-away or cooldown ends. Events older than 15 seconds at the trusted boundary are discarded. Current gift count is used, not the gifter's lifetime total. Bits and subscription counts are not converted into currency. Gifted recipient subscriptions are ignored because the gift-bundle event already accounts for them. Anonymous gifts/Cheers work without retaining a donor identity or message text.

The **Automatic stream event reactions enabled** preference controls all these reactions and automatic busy-chat peeks. Busy chat also honors chat engagement and initiative; at least 3 distinct chatters are needed, so a lone chatter cannot trigger a peek. Quiet, tuck-away, manual/streamer priority and character capabilities are respected. Seated characters do not start a foot dance. Addressed chat does not interrupt an event expression.

The next streamer-initiated Twitch authorization requests `user:read:chat`, `channel:read:subscriptions`, and `bits:read`. These are read-only. Existing chat-only grants continue to work, with gift/subscription/Bits sources labeled as requiring reauthorization. Source readiness is confirmed independently by EventSub; a failed gift subscription does not falsely disconnect chat. No authorization is launched automatically.

External money donations remain separate and require a trusted provider adapter. Existing Studio money-donation previews remain clearly simulated, using their original 8-second cooldown and configured currency thresholds. They do not manufacture live donation events.

Twurple 8.2 deduplicates Twitch notification message IDs before callbacks (10-minute library window). Because its typed event objects do not expose the envelope ID, adapter provenance IDs are local UUIDs; the conductor also deduplicates normalized IDs and never replays suppressed events. Tokens and authorization secrets are not included in public event status.

Verification covers deterministic policy, gateway callbacks and the local integration boundary using test fixtures. Real authenticated EventSub delivery, OBS and Tauri still require live verification.

Official API references: [EventSub subscription types](https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/) and [Twitch access token scopes](https://dev.twitch.tv/docs/authentication/scopes/). Installed Twurple declarations define `onChannelRaidTo`, `onChannelSubscriptionGift`, `onChannelSubscription`, and `onChannelCheer`.
