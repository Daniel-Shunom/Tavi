# Tavi implementation plan

Status: implementation roadmap based on the repository inspected on October 25, 2026. This document distinguishes observed code, previously verified behavior, and proposed work. It does not claim a new runtime verification of the other agent's integration.

## Product objective

Tavi is a customizable, expressive human/chibi companion for Twitch streamers. It lives in the OBS canvas, hears the streamer, reads chat, and participates occasionally according to the streamer's chosen personality. Its primary value is entertaining companionship: expressive reactions, timing, playful presence, and moments the streamer can play off.

The streamer comes first. Quiet, retract, stop, and listening controls must be immediate. Voice output is optional; understanding the streamer's speech and expressing a contextual response are part of the intended first implementation.

Delivery constraint: eight total days, solo development; target a complete end-to-end build by day four and use the remaining four days for refinement and testing. The checkpoints below organize remaining work and do not restart the original eight-day clock. Reassess against actual remaining time before assigning calendar dates.

## 1. Current implementation and gaps

| Area              | Observed state                                                                                                                             | Remaining gap                                                                                                                                                              |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Studio            | Avatar-centered stage, separately scrolling tools, lighting presets, direct wave interaction, expression controls                          | Tune interaction feedback and expose meaningful performance state; keep tools from obscuring the avatar                                                                    |
| Renderer          | Rive runtime integrated into `src/renderer/Avatar.tsx`; local WASM and character asset; portrait and transparent-overlay presentations     | Finish animation composition, visible pose channels, and consistent expressive range                                                                                       |
| Performances      | Director sequences listening, skeptical, caught, nod, celebration, wave, tuck, and a scripted scene                                        | Mostly authored cues; no autonomous attention or context-based selection                                                                                                   |
| Pose output       | Clip blending, offsets, scale, rotation, labels, and captions are computed                                                                 | Rotation is passed in placement but not consumed by `riveRig.draw`; generated captions are not presented by the studio/overlay                                             |
| Gestures          | Expanded shared gesture vocabulary                                                                                                         | Several legacy gestures alias another performance: smile to nod, surprise to celebrate, point to listening. They are not visually distinct capabilities                    |
| Personality       | Cozy/playful/shy presets; gentle/cheeky/spicy attitude exists in configuration and performance weighting                                   | No independent initiative setting, persistent persona specification, contextual timing, or consistent habits                                                               |
| Appearance        | Rive hair, outfit, and glasses palette variants; saved configuration                                                                       | One hairstyle and built-in glasses; no full modular avatar builder. Legacy skin/hair/outfit/hairstyle fields remain in the schema but are not used by the current renderer |
| Twitch            | Public device OAuth, Twurple EventSub, bounded recent chat, deletion handling, refresh/validation, disconnect                              | Current reactions are name-triggered rules with cooldowns, not semantic understanding. Tokens are memory-only                                                              |
| Streamer audio    | No microphone pipeline                                                                                                                     | Device selection, listening mode, speech detection, transcription, and streamer-directed commands                                                                          |
| AI                | No decision adapter                                                                                                                        | Provider configuration, bounded context, structured decisions, timing policy, failure fallback, and cost controls                                                          |
| Scene interaction | Saved normalized positions, fixed anchor presets, edge peek, retraction                                                                    | Real editable perch geometry, occlusion, gaze targets, and meaningful pointing                                                                                             |
| Synchronization   | Service-authoritative configuration/action messages                                                                                        | Actions contain an ID and gesture, without shared start/expiry times, priority, intensity, or cancellation semantics                                                       |
| Persistence       | Local character configuration                                                                                                              | Versioned profiles, import/export, and deliberate handling of session context and credentials                                                                              |
| Desktop           | Tauri shell and service packaging prepared by another agent                                                                                | Installed-app verification, external-browser authorization handoff, packaged Rive/WASM assets, device permissions, and lifecycle testing                                   |
| Quality           | Strict TypeScript, no-any/type-aware lint rules, Prettier pre-push hook, CI, app tests, browser smoke scripts, pinned project-local skills | Broaden meaningful tests for the new behavior system and run current integration in OBS and the installed desktop app                                                      |

Twitch authorization and a real message-to-wave reaction were verified earlier in this session. That proves the existing live-chat path, not future AI or microphone behavior. Re-run appropriate checks after the current parallel integration settles.

Implementation references: `shared/protocol.ts`, `src/renderer/performance.ts`, `src/renderer/riveRig.ts`, `src/renderer/Avatar.tsx`, `server/twitch/reactions.ts`, `src/studio.tsx`, and `desktop/README.md`. Existing product direction: `docs/PERSONALITY.md`. Character attribution: `public/credits/rive-avatar.md`.

## 2. Why expressiveness feels limited

Adding buttons alone will not make Tavi feel alive. Four layers need to work together:

1. **Range:** distinguish gaze, brows, eyelids, mouth, head, torso, and hands where the current asset supports them. Some requested expressions may require editing or replacing the rig.
2. **Performance:** give an expression anticipation, an accent, a readable hold, and a natural recovery. Avoid snapping between unrelated clips or stacking conflicting poses.
3. **Attention:** make it clear what Tavi is reacting to: the streamer, chat, a selected panel, or nothing in particular.
4. **Intent and timing:** choose when a response is warranted, how strong it should be, and when silence is better. Personality should change those choices, not merely a caption.

Start by making six performances visibly distinct at the actual OBS size: attentive listening, skeptical glance, caught/innocent, restrained approval, celebration, and greeting. Keep tucked, quiet, and neutral states dependable.

## 3. Recommended architecture

```text
Microphone / Twitch / studio controls
                |
       Normalize input events
                |
  Bounded session context + user personality
                |
  Fast local rules / structured AI decision
                |
  Priority, cooldown, cancellation, and expiry
                |
  Shared performance cue with explicit timing
                |
  Renderer adapter -> Rive capabilities
                |
     Studio portrait + OBS canvas
```

Keep the current TypeScript/Node stack, Twurple integration, and Rive renderer. Extend the existing Director before adding another orchestration library. Rendering must continue without waiting for a network/model response.

A cue should express intent and constraints: action, target, intensity, duration, optional short caption, source event ID, priority, start time, expiry, and cancellation group. The application validates the cue against the loaded character's capabilities. The AI cannot create arbitrary animation names or manipulate desktop applications.

Use the same cue and clock contract for studio and OBS. A newly connected overlay should receive current state and resume appropriately, without replaying old reactions. Discard expired responses. Character/model changes should not require rewriting input adapters.

## 4. Priority and delivery policy

- **P0 - complete demo:** required for the end-to-end hackathon experience.
- **P1 - refinement:** polish and reliability during the remaining refinement days, after P0 works.
- **P2 - product roadmap:** worthwhile scope that must not delay the demonstration.

At every checkpoint, keep a working manual/demo path. Finish and test a vertical slice before starting the next. If time contracts, reduce the expression/catalog scope and optional integrations before sacrificing reliability or mislabeling simulated input as live behavior.

## 5. Work packages

### A. Finish the expressive performance foundation - P0, first

- Inventory actual Rive animations/parameters and record supported expressions, appearance variants, and targets in a character capability manifest.
- Apply rotation correctly in the drawing adapter; verify transform units, pivots, resize behavior, and reduced-motion handling.
- Surface optional performance captions/labels. Keep them short and unobtrusive, with independent streamer controls for studio versus stream visibility.
- Separate or honestly rename the current smile/nod, surprise/celebrate, and point/listening aliases. Unsupported pointing must not appear as a working capability.
- Add anticipation, hold, and recovery phases; blend compatible layers and give conflicting layers clear ownership.
- Introduce intensity variants and a small selection of authored variations, chosen without immediate repetition.
- Ensure quiet/retract/idle and a new manual cue cancel active scenes predictably.
- Honor reduced motion across both host movement and authored character clips. Removing only positional movement is not enough if a clip still contains large gestures.

**Done when:** six core reactions are distinguishable in OBS, return to a clean idle, and can be interrupted immediately. Captions and pose changes agree. Studio and OBS show the same current performance. No new renderer is required for this checkpoint.

### B. Add attention, idle life, and direct interaction - P0

- Introduce a stable attention target: streamer/webcam, chat, pointer in the studio, or neutral.
- Add bounded head/eye tracking only where the rig supports it; smooth it and release toward neutral.
- Make click-to-wave a richer invitation: acknowledge the click, react, settle. Add keyboard equivalents and avoid triggering stream behavior from every incidental hover.
- Define a few low-intensity idle behaviors: glance away, posture reset, look back, small curiosity. Vary intervals rather than looping continuously.
- Idle scheduling is local and inexpensive. Quiet mode suppresses initiative; retract remains hidden until restored.
- Expose initiative separately from energy and attitude. Default to occasional, cheeky, and streamer-first, consistent with `docs/PERSONALITY.md`.

**Done when:** Tavi remains subtly alive for a minute without input, reacts to deliberate interaction, and does not become visually busy. Quiet mode visibly reduces activity. Document the distinction between studio pointer interaction and viewer chat interaction.

### C. Establish the reaction policy and shared cue contract - P0

- Replace the single last-gesture concept with validated, timed performance cues and explicit cancellation.
- Prioritize streamer stop/retract/quiet controls above all automatic input. Explicit manual performances override automatic ones; streamer-directed input outranks chat; idle is lowest.
- Implement interruption policy, expiration, bounded queues, duplicate suppression, and a shared reaction budget.
- Use energy for movement intensity, attitude for interpretation/style, initiative for frequency, and chat engagement for viewer participation. Document their effects.
- Make no-reaction an explicit valid decision. Never queue a long sequence of reactions to catch up after a busy period.
- Retain existing cooldowns as a fallback while tuning richer policies. Suppress outdated cues following a mode change or source-message deletion.

**Done when:** a burst of chat cannot override a streamer interaction; late model responses cannot revive canceled behavior; reconnecting OBS does not replay stale gestures. Rule-based and future AI decisions pass through the same policy.

### D. Add streamer listening and transcription - P0

- Implement microphone permission, device selection, input level, and an unmistakable listening indicator.
- Recommended first mode: push-to-talk for reliable deliberate interaction. Continuous listening with speech segmentation is the next increment; final default remains a product decision.
- Add a replaceable transcription adapter and a short-lived transcript buffer. Report permission, missing-device, provider, and network failures clearly.
- Feed finalized utterances into normalized streamer events. Show partial results only as UI feedback, not repeated reaction triggers.
- Support fast local commands such as hide, stop, quiet, and come back, with clear handling of direct address and quoted/negated speech.
- Do not infer emotional tone from plain transcription as if actual vocal sentiment were analyzed.

**Done when:** the streamer can speak an intentional sentence and receive one appropriate reaction; stopping listening really stops capture; quiet and retract controls still work during provider failures. Verify in the actual Tauri WebView as well as the development browser.

### E. Add contextual AI decisions and personality - P0, after C and D

- Configure one provider through the service and a replaceable adapter; keep credentials out of the browser and shared overlay state.
- Define a compact persona: name, attitude, initiative, energy, boundaries, and a few authored preferences/habits. Treat presets as complete defaults.
- Supply bounded recent streamer utterances and selected chat messages, tagged with their sources. Twitch messages are contextual input, not trusted application instructions.
- Require structured output: react or remain idle, supported action, target, intensity, optional short caption, and expiry. Validate it before scheduling.
- Combine immediate local listening cues with later semantic decisions; do not call the model for blinks, breathing, or every chat message.
- Implement timeouts, cancellation, usage limits, and a deterministic fallback. Do not execute fabricated or unsupported gestures.
- Tune against the agreed personality examples: playful skepticism after obvious boasting, room for genuine achievements, and no automatic praise of every action.

**Done when:** the same short scenario produces meaningfully different restrained behavior under different personality settings, Tavi sometimes chooses not to react, and a failed provider leaves a usable companion. Ship genuine context-based input, not only a scripted demonstration.

### F. Improve viewer participation - P0 minimum, P1 breadth

- Route live Twitch context through the shared policy instead of a separate gesture shortcut.
- Keep direct address and a small supported command vocabulary for the first demo. Add contextual selection only once streamer input is reliable.
- Preserve moderation deletion, duplicate handling, disconnect, and credential-validation behavior.
- Make connection health and suppressed-reaction reasons understandable in studio diagnostics.
- Keep outgoing chat disabled for the initial build. Optional text replies require a deliberate scope upgrade, chosen account identity, rate limits, and an explicit enable control.
- Secure token persistence through an OS-backed desktop mechanism is P1. Reauthorization after restart is an acceptable documented demo limitation.

**Done when:** a live message can invite a reaction without interrupting streamer interaction, moderation removes the relevant context, and the authorized channel is clear. Retest real delivery after behavior integration.

### G. Make OBS scene interaction believable - P0 minimum, P1 breadth

- Replace fixed preset-only placement with editable normalized rectangles, perch points, gaze targets, and avoid areas.
- Keep the studio portrait centered while showing an accurate separate placement preview.
- Build one complete perch/peek interaction against a configured webcam rectangle and one chat-area attention target.
- Define occlusion deliberately. A character cannot automatically appear behind an arbitrary independent OBS source merely by moving a transparent browser source; coordinate layers or apply a matching mask.
- Point at specific messages only when Tavi renders/knows that message's position. Otherwise point toward the configured chat region.
- OBS WebSocket source discovery and scene-change synchronization are P1; manual anchors remain the fallback. Desktop-window recognition and arbitrary clicking are out of initial scope.

**Done when:** Tavi perches and peeks convincingly in one real OBS scene, stays inside safe boundaries, and remains correctly placed at supported canvas resolutions.

### H. Complete customization and saved profiles - P0 starter set, P2 full builder

- Expose only changes supported by the active character. Capability metadata drives controls and fallback behavior.
- Add configuration versioning and migrate legacy Pixi appearance fields rather than silently presenting them as effective Rive controls.
- Ship a coherent starter set of palette choices, name, attitude, initiative, energy, and chat participation settings.
- Add reset and import/export of non-secret character/personality/placement profiles in P1. Provide a recoverable path for invalid files.
- For the full Snapchat-style goal, plan compatible face, skin, hair shape, eyes, outfit, and accessory parts with a shared rig contract. This requires authored assets/rigging; the runtime alone does not supply it.
- Keep visible third-party attribution. Original art, multiple body/rig families, and an asset catalog are P2.

**Done when:** every visible customization has a visible effect, profiles survive restart, and older settings migrate without resetting unrelated choices. Document the starter kit's actual limits.

### I. Make the studio explain the companion - P0 feedback, P1 polish

- Preserve the avatar-centered stage and unobstructed scrolling tools through the integration.
- Show listening/thinking/reacting/quiet/tucked states, last input source, connection health, and short actionable errors.
- Add a developer-only reaction inspector showing candidate input, chosen action, suppression reason, timing, and latency. Do not expose implementation detail in the normal streamer flow.
- Add an expression gallery and reproducible scenario controls for comparison, clearly separated from live input.
- Verify new gesture controls fit mobile and smaller desktop windows; the expanded Rive control dock is wider than the original prototype.
- Make captions, scene movements, animation intensity, and reduced motion configurable. Ensure keyboard access and visible focus remain intact.

**Done when:** a new streamer can connect Twitch, choose a microphone/personality, test Tavi, and add the overlay without reading source code.

### J. Desktop, release, and reproducibility - P0 demo path, P1 hardening

- Coordinate all Tauri changes with the desktop owner; confirm ownership before concurrent edits.
- Verify packaged Rive asset/WASM loading without a development server or CDN.
- Verify external-browser Twitch authorization, microphone access, local service readiness, occupied ports, reconnect, and child-process cleanup.
- Test the installer on a clean Windows machine. Preserve license notices for artwork, runtime, dependencies, and bundled Node.
- Rebuild generated desktop service resources after web/service dependencies change; an old desktop resource bundle is not proof of the current app.
- Keep pinned local skills, npm lockfiles, strict compiler/lint settings, pre-push formatting, and CI. Root Vitest tests stay scoped to the app; experiments retain separate runners.
- Update README, quick start, known limitations, credits, and the demo script to match the Rive implementation.

**Done when:** a fresh setup runs, the installed app and OBS work together, errors are recoverable, and stopping Tavi does not leave orphaned services.

## 6. Integration order and parallel ownership

| Checkpoint | Implementation slice                                    | Depends on                                    | Reviewable result                                                       |
| ---------- | ------------------------------------------------------- | --------------------------------------------- | ----------------------------------------------------------------------- |
| 1          | A: performance fixes and capability inventory           | Current Rive integration settled              | Six distinct, interruptible expressions in the actual app               |
| 2          | B + C: attention, restrained idle, timed cues           | 1                                             | Character feels present and automatic input cannot overwhelm it         |
| 3          | D: microphone through transcription to a local reaction | 2                                             | Streamer speech produces a real response                                |
| 4          | E + F: contextual decision through the same policy      | 3                                             | Streamer-first AI companion with limited live viewer interaction        |
| 5          | G + H + I minimums                                      | 2; proceed alongside 3-4 with clear ownership | One convincing OBS scene, honest customization, understandable controls |
| 6          | J: installed demo and rehearsal                         | 4-5                                           | End-to-end hackathon build ready for refinement                         |

This is the four-day build target, not a promise that every P1/P2 item fits it. Use the remaining four days for stronger performances, art, latency/behavior tuning, recovery tests, installer/OBS verification, and submission preparation.

Suggested boundaries: renderer agent owns performance and rig changes; app/service agent owns cue protocol, input adapters, policy, and studio feedback; desktop agent owns Tauri and packaging. The user remains the product decision-maker. Shared protocol edits need one designated owner and explicit coordination.

## 7. Acceptance scenarios

| Scenario                                            | Expected result                                                                      |
| --------------------------------------------------- | ------------------------------------------------------------------------------------ |
| No input for one minute                             | Subtle varied idle, no repetitive attention-seeking routine                          |
| Streamer addresses Tavi                             | Immediate listening cue, one contextual response, natural recovery                   |
| Streamer boasts after an obvious mistake            | Attitude-appropriate skeptical response; no automatic congratulation                 |
| Streamer achieves a genuine win                     | Appropriate celebration without treating every remark as a victory                   |
| Viewer addresses Tavi during streamer input         | Defer or ignore viewer reaction; do not interrupt the streamer                       |
| Burst of repeated chat                              | Deduplicate and respect a shared budget; no backlog playback                         |
| Quiet or retract during a pending AI request        | Cancel the pending reaction; no delayed comeback                                     |
| User replaces an active scene with a manual gesture | New gesture takes priority and the old scene never resumes unexpectedly              |
| Deleted chat message                                | Remove it from history/context and invalidate any queued response to it              |
| AI or transcription unavailable                     | Clear status, no frozen animation, local controls remain functional                  |
| OBS reconnects or changes resolution                | Correct current pose/state and placement; no replay of stale cues                    |
| Reduced motion enabled                              | Readable expressions with large motion suppressed across clip and host layers        |
| Restart installed Tavi                              | Character/settings return; documented Twitch reconnect or secure token restore works |
| Customize supported appearance                      | Visible change in both stage and overlay, without resetting unrelated settings       |

## 8. Refinement and release gates

Test behavior at public boundaries: normalized input to approved cue, cue to rendered performance, Twitch lifecycle, configuration migration, and studio/overlay synchronization. Use fake clocks/provider fixtures for repeatable timing and cancellation tests; retain real-browser, real-OBS, and installed-app checks for rendering and devices.

Record latency from event receipt to first local cue and to completed semantic decision, plus model calls per minute, dropped/expired decisions, and reaction frequency. Set budgets after measuring on the target streaming PC; do not invent guaranteed latency or cost figures.

Release gates:

- Formatting, type-aware lint, strict TypeScript/no-any rules, app tests, build, and local skill verification pass.
- Browser tests cover stage visibility, tool reachability, supported customization, performance cancellation, and transparent overlay.
- OBS verification covers visibility changes, resize, reconnect, and simultaneous studio/overlay rendering.
- A longer session shows bounded memory/context and acceptable CPU/GPU use while streaming.
- Live OAuth/chat and microphone tests succeed on the demo machine.
- Credits, setup instructions, documented limitations, and a reproducible reset/demo path are ready.

## 9. Decisions still needed

1. Listening: approve push-to-talk as the first checkpoint, then decide whether continuous listening is required for the judged demo.
2. AI/transcription: provider, available keys, acceptable spend, and offline fallback expectations.
3. Character: keep the current attributed Rive asset for the hackathon or invest time in a compatible original rig. Decide based on tested expressive capability, not cosmetic preference alone.
4. Captions: whether short captions appear on stream by default or only in the studio.
5. Scope cutoff: identify the remaining P0 items that fit the real time left; do not silently promote every refinement to a requirement.

Voice output, voice cloning, gameplay/screen understanding, autonomous desktop control, a character marketplace, cloud accounts, and multi-platform expansion are P2 unless explicitly reprioritized. They do not block proving the core companion experience.

## 10. Recommended next task

Implement work package A first: audit the actual rig, fix unapplied pose channels, surface optional captions, remove misleading gesture aliases, and make six small performances clearly readable at stream size. Then add attention and the reaction policy before expanding the number of animations. Review that checkpoint before committing scarce time to a new rig or provider stack.
