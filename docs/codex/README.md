# Building Tavi with Codex

[Judge guide](../JUDGING.md) | [Project README](../../README.md)

This is the development record for OpenAI Codex's role in Tavi. It describes development assistance separately from the optional AI model that runs inside the product.

## Session IDs

| Recorded ID                            | Evidence                                                                                                                | Submission status                                                                                                                                                                                                          |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `01a17704-cc9a-7d01-822a-754a6062ab3c` | [Repository session file](../../.session_id) and [connection handoff](../CHATGPT-CONNECTION.md)                         | Primary build thread, confirmed by the creator on October 30, 2026.                                                                                                                                                        |
| `01a18a34-1887-7b23-856c-37b639a87cea` | [Supporting session list](../../.sessions); verified from `CODEX_THREAD_ID` and `CODEX_SESSION_ID` on November 1, 2026. | Foundation installer integration/verification and the isolated browser judging preview, including session lifecycle, Studio/overlay wiring, tests, and Vercel deployment scaffolding. Cloud deployment remains unverified. |

The hackathon requests the main build thread's ID. The creator confirmed that the recorded thread contains most of the build. Use `/status` in that thread if you need to retrieve the ID again; `.session_id` remains its repository copy. The [`.sessions` list](../../.sessions) records the primary and verified supporting IDs. Add genuinely recorded supporting thread IDs with their scope when available; do not substitute Git commits, subagent names, or CodeRabbit run IDs.

## Collaboration and ownership

The human creator defined the streamer-first companion, the warm lavender/private-studio direction, interaction priorities, minimal UI copy, and the desired user-funded AI connection. Human feedback drove repeated changes to layouts, character staging, and motion. The creator also supplied the later landing redesign and retained decisions about review and release.

Codex inspected the repository, proposed reviewable changes, implemented authorized work, and used tests and browser checks to investigate behavior. Work was split into explicit milestones and, when requested, focused subagents. Examples include separate Studio design/technical reviews and the stream-event reaction task. Project-local instructions and pinned skills supplied design, React, motion, and verification guidance; they did not replace human product decisions.

This was not exclusively Codex-authored work. The repository also contains work made with Claude Code and other collaborators, documented in the [earlier handoff](../HANDOFF.md) and commit history. Character art and some scene assets are third-party originals adapted for Tavi. See [credits](../../public/credits/) and [character attribution](../../public/credits/rive-avatar.md). The documentation does not claim Codex created those original assets or independently approved all product decisions.

## Revision scope

This README records work across development threads and branches. The current main revision includes the redesigned landing and its core dependencies. The private Studio pass, extended stream-event reactions, and ChatGPT sign-in remain outside this revision. Paths explicitly marked as missing below are a work record, not shipped functionality or complete submission evidence. Integrate and validate those features before claiming them in the submitted build.

## Concrete Codex contributions

| Area                           | How Codex was used                                                                                                                                                                  | Inspectable evidence                                                                                                                                                                                                             |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Studio UX                      | Reviewed the layout, produced HTML studies, and implemented setup/live controls with short copy and responsive behavior.                                                            | [Studio](../../src/studio.tsx), styles (`../../src/private-studio.css`, not included in this revision), [design direction](../../DESIGN.md), UI studies (`../design/`, not included in this revision)                            |
| Twitch interaction             | Added normalized event handling and bounded reactions for raids, gifts, subscriptions, Bits, and busy chat, including cooldowns and quiet/manual-control priorities.                | [Event design](../STREAM-EVENT-REACTIONS.md), conductor (`../../server/behavior/streamEvents.ts`, not included in this revision), tests (`../../tests/stream-events.test.ts`, not included in this revision)                     |
| AI connection                  | Consulted official OpenAI documentation and implemented user-authorized ChatGPT sign-in, identity validation, local encrypted storage, account model selection, and rules fallback. | [Connection guide](../CHATGPT-CONNECTION.md), adapter (`../../server/ai/chatgpt.ts`, not included in this revision), [manager](../../server/ai/manager.ts), tests (`../../tests/chatgpt.test.ts`, not included in this revision) |
| Landing and motion integration | Helped stage a browser-rendered CRT/desk scene, connect Rive motion to the page, and integrate the creator's later redesign for review.                                             | [Landing](../../src/LandingPage.tsx), [scene](../../src/CrtScene.tsx), [motion modules](../../src/landing/), [landing PR](https://github.com/Daniel-Shunom/Tavi/pull/1)                                                          |
| Verification and review        | Ran behavior, type, build, skills, and real-browser checks; prepared an isolated integration branch and configured CodeRabbit PR review.                                            | [Browser checks](../../tools/browser-check.mjs), [tests](../../tests/), [review PR](https://github.com/Daniel-Shunom/Tavi/pull/1)                                                                                                |

These source links identify the relevant implementation, not exclusive authorship of every line. A working-tree file or open PR only becomes submission evidence when it is included in the submitted revision. Use Git history and the linked session records together to trace the work.

## An example of debugging with Codex

The first ChatGPT connection returned an unhelpful generic failure. Codex added safe errors for each sign-in stage rather than displaying raw tokens or provider responses. The next attempt identified code exchange as the failure point. A credential-free network probe then failed with `EACCES` inside the development sandbox and reached OpenAI outside it. Restarting the local service with network access resolved that blocker, after which the creator confirmed connection.

An earlier encryption diagnosis was incorrect: its check used invalid base64 input. A valid Windows DPAPI roundtrip passed. This correction is recorded in the [connection handoff](../CHATGPT-CONNECTION.md). Connection success is separate from proving a live AI reaction; the submitted demo should show actual model provenance if AI behavior is demonstrated.

## Verification evidence and limits

The landing integration branch passed 509 tests across 63 files, its production build, lint, type checking, and verification of 17 pinned skills/200 files. Chromium checks exercised desktop/mobile landing controls, Studio customization, reactions, retraction, scene placement, and the transparent overlay. These are results for that integration revision, not a guarantee for every branch or a future submission commit.

The AI work separately passed its 19 account-flow tests with fake OAuth responses. Automated fixtures do not establish live Twitch delivery or real account consent. OBS output, packaged Windows builds, live Twitch events, and a completed AI reaction should be checked on the exact submitted build. Follow the [judge walkthrough](../JUDGING.md#try-tavi).

## How to reproduce and audit

Use the [setup and validation commands](../DEVELOPMENT.md#validate), [project instructions](../../AGENTS.md), and [implementation roadmap](../IMPLEMENTATION-PLAN.md). The codebase keeps service/renderer contracts in `shared/`, behavior and providers in `server/`, and browser rendering in `src/renderer/`.

Useful history commands:

```sh
git log --oneline --all
git log --follow -- src/studio.tsx
```

Local development commit `533a573` records the ChatGPT sign-in implementation; it is not part of this revision. The linked landing PR records its integration and review work. Neither a commit ID nor a CI run is a Codex session ID.

Keep session identifiers and relevant development summaries public for judging, but do not publish raw account tokens, local `.data/` contents, private chat transcripts, or unredacted diagnostic captures.
