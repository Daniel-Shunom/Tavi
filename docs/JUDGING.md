# Tavi judge guide

[Project README](../README.md#for-judges) | [Codex development README](codex/README.md)

Tavi turns Twitch activity into an expressive on-stream companion. The evaluation path below separates a quick local trial, live Twitch/OBS integration, and optional AI behavior. The landing animation is an authored demonstration, not footage of a live Twitch session.

## Submission materials

| Item                        | Location / status                                                                                                                                  |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Source repository           | [Daniel-Shunom/Tavi](https://github.com/Daniel-Shunom/Tavi). Submit a named revision that contains the working features and their assets.          |
| Public demo video           | **Pending:** publish a YouTube video under three minutes and add its URL here and to Devpost.                                                      |
| Devpost project entry       | **Pending:** add the submitted project URL here. The [hackathon page](https://twitchcon-codex.devpost.com/) is not the project's submission entry. |
| Project description         | [README description](../README.md#project-description), with development context in the [Codex README](codex/README.md).                           |
| Main Codex session          | [Recorded IDs and confirmation instructions](codex/README.md#session-ids). The creator confirmed the recorded ID as the primary build thread.      |
| Installation and evaluation | [Source setup](RUNNING.md) and [Windows instructions](../desktop/README.md). Verify any published installer matches the submitted source.          |

These requirements were checked on October 30, 2026 against the [official overview](https://twitchcon-codex.devpost.com/) and [rules](https://twitchcon-codex.devpost.com/rules). The published deadline is November 2, 2026 at 2:00 p.m. Pacific. Recheck the official pages before submission.

## Revision scope

This documentation accompanies the current main revision. It contains the landing, core Studio/overlay, and existing chat integration. The separate ChatGPT sign-in and extended stream-event work has not been integrated into this branch. Those sections below are conditional instructions for a later submitted revision that includes that code. Do not present them as available in this revision.

## Try Tavi

### Quick local trial

1. Follow the [source setup](RUNNING.md), or use a verified Windows release via the [desktop guide](../desktop/README.md).
2. Open Studio: development `http://127.0.0.1:5173/studio`; production/local app `http://127.0.0.1:4318/studio`.
3. Change appearance or personality, then use the manual expression controls and Reaction tests. Typed and simulated inputs are explicitly local test inputs.
4. Try Quiet mode and tuck/bring-back controls. Confirm that automatic activity yields to these controls.

This core path needs no paid AI account or service API key. Keep the local service/app running. A static website deployment alone does not run Studio's backend.

### Demonstrate real Twitch and OBS behavior

1. In OBS, add a Browser Source for `http://127.0.0.1:4318/overlay` (or `5173/overlay` during development), with dimensions matching the stream canvas. Confirm transparency and placement.
2. Connect the streamer's own Twitch account in Studio and approve the read-only permissions. See [Twitch setup](../README.md#connect-twitch).
3. Send an actual channel chat message addressing the companion by name. Keep Quiet mode off, Tavi visible, and chat engagement above zero; allow the configured cooldown to pass.
4. Show the overlay reacting in OBS and the corresponding live activity in Studio. On a revision that includes the extended event integration, for raids, gifts, subscriptions, or Bits, show only genuinely received events as live; previews remain simulations. Read the [event policy](STREAM-EVENT-REACTIONS.md) for thresholds and cooldowns.

### Optional ChatGPT reactions

On a revision containing the AI connection, select **Decision provider > Continue with ChatGPT** and authorize an eligible account. Confirm the active provider is ChatGPT, then submit a typed message such as "Tavi, we just won!" through Reaction tests. Inspect **Last decision** to distinguish an AI result from rules fallback. A successful account connection alone is not proof that a model generated a reaction.

This directs expressions and captions; it does not provide spoken voice, microphone listening, or free-form chat replies. See [account setup and recovery](CHATGPT-CONNECTION.md). Rules remain available if the account or model is unavailable.

## Judging criteria map

| Published criterion          | What to inspect in Tavi                                                                                                                      |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Innovation / Idea            | The expressive companion concept, personality, scene-aware attention, and how Twitch activity becomes character acting.                      |
| Potential Impact             | Whether reactions make streams more engaging while quiet mode, cooldowns, and manual priority preserve streamer control.                     |
| Technological implementation | Validated shared contracts, service/overlay synchronization, Twitch EventSub integration, model fallback, and the documented Codex workflow. |
| Design                       | Studio usability, readable small-scale expressions, responsive controls, and the visual/motion treatment of the landing and overlay.         |

The judging criteria are from the [official overview](https://twitchcon-codex.devpost.com/#judging-criteria); these inspection examples are our project-specific guide.

## Technical review map

| Topic                                          | Evidence                                                                                                                                                                                        |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Development with Codex                         | [Workflow, session IDs, examples, and attribution](codex/README.md)                                                                                                                             |
| App structure and evaluation commands          | [README](REPOSITORY-LAYOUT.md), [tests](../tests/), [browser smoke check](../tools/browser-check.mjs)                                                                                           |
| Twitch event processing                        | [Gateway](../server/twitch/gateway.ts), event conductor (`../server/behavior/streamEvents.ts`, not included in this revision), [policy](STREAM-EVENT-REACTIONS.md)                              |
| Overlay contract and rendering                 | [Shared contracts](../shared/), [renderer](../src/renderer/), [expression system](EXPRESSION-SYSTEM.md)                                                                                         |
| AI scope, local credential handling, fallback  | [Connection guide](CHATGPT-CONNECTION.md), [providers](../server/ai/)                                                                                                                           |
| Windows distribution and OBS setup             | [Desktop handoff](../desktop/README.md)                                                                                                                                                         |
| Third-party artwork, scene assets, and footage | [Credits directory](../public/credits/), [Rive character attribution](../public/credits/rive-avatar.md), [TV](../public/credits/television-01.md), [desk](../public/credits/wooden-table-02.md) |
| Planned work and outstanding acceptance checks | [Implementation plan](IMPLEMENTATION-PLAN.md). Older handoffs are dated snapshots, not current feature guarantees.                                                                              |

## Suggested video outline

Aim for about 2:45 so the video stays below the three-minute limit.

- **0:00-0:20:** show Tavi in the Twitch/OBS context and explain the streamer problem.
- **0:20-1:15:** capture a real channel message and its visible overlay reaction. Label any separate test inputs.
- **1:15-1:55:** show customization, personality, placement, and quiet/manual control.
- **1:55-2:45:** show Codex development evidence: a real prompt/change/debug cycle, relevant source or checks, and the main thread's session ID. Explain asset and collaborator attribution.

## Before submitting

- [x] Identify the main Codex build thread: the creator confirmed the ID in the session registry. Copy it into the Devpost submission.
- [ ] Publish the short demo publicly on YouTube and insert the URL above. Include live Twitch operation and Codex development footage.
- [ ] Complete the Devpost project description and add its project URL above.
- [ ] Commit all required source/assets/docs into the submitted revision; ensure linked files exist on that revision and open PRs are handled deliberately.
- [ ] Verify a fresh checkout can run with the documented commands. Re-run app checks and live Twitch/OBS verification on that revision.
- [ ] Ensure judges can access and test the submitted project without a project-imposed payment gate during judging; keep the core rules path available without a paid AI account.
- [ ] Review artwork, font, footage, and music permissions; retain attribution and remove any unverified material from the submission/video. The [earlier handoff](HANDOFF.md#before-a-public-hackathon-submission) records an outstanding asset-license audit.
- [ ] Confirm all submitted materials are in English, the video is public, and any private repository access follows Devpost's instructions.

This checklist records readiness work; it is not a claim that the project has already been submitted or that the outstanding checks are complete.
