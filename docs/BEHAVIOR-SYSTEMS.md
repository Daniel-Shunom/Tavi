# Behavior systems: research and direction

How Tavi decides what to do, what the field has learned about believable companions, and the
architecture we are growing toward. The first layer (affect + pacing) is implemented; the rest is
the roadmap. Everything here is deterministic rules unless it says AI.

## Where Tavi was

Tavi's body was already strong: saccadic gaze, Poisson-timed blinks, personality-weighted
fidgets, follow-through, body states (stand, sit, doze, nap, peek, perch, lean), gaits and
three-quarter turns. The gap was the mind:

- No internal state that changes over a stream. Personality was static configuration.
- No memory beyond a 5-minute, 10-event conversation context.
- Idle choices were near-fixed timers; roaming (where present) cycles anchors in a fixed order.
- AI only reacts to addressed chat and streamer lines, from a closed vocabulary. That stays.

## What the field converges on

1. **Layer like a robot** (Brooks' subsumption; Disney's gaze stack). An always-on base (breath,
   blink, gaze) under a self-occupied default activity, with interrupting reactions on top.
   Higher layers suppress lower ones but never stop them. Disney's robot gaze uses
   Read (self-occupied) / Glance / Engage / Acknowledge.
   [Disney Research](https://la.disneyresearch.com/publication/realistic-and-interactive-robot-gaze/)
2. **Emotion, then mood, then personality** (ALMA, Gebhard 2005). Events cause short emotions
   that decay in seconds; mood integrates them over minutes and relaxes to a personality
   baseline. Mood lives in PAD space (pleasure, arousal, dominance). Arousal maps to tempo;
   dominance to boldness. [DFKI](https://www.dfki.de/web/forschung/projekte-publikationen/publikation/1782)
3. **Drives with a comfort zone** (Kismet, Breazeal). Understimulated reads as bored,
   overwhelmed as distress, plus fatigue. Dead chat vs. flooded chat maps onto this directly.
   [MIT](https://groups.csail.mit.edu/lbr/sociable/homeostatic-regulation.html)
4. **State through behavior, never meters** (Petz, Stern et al. 1997). The audience reads mood
   like an actor's performance: a sad shuffle vs. a happy trot. Personality changes _how_, not
   _what_. [AAAI](https://alumni.media.mit.edu/~benres/verbiage/Socially%20Intelligent%20Virtual%20Petz.htm)
5. **Smart objects advertise** (The Sims). Objects advertise which need they satisfy; the
   character scores advertisements against its needs. For Tavi: anchors advertise rest, social,
   curiosity, so new anchors add behavior without code.
6. **Most specific rule wins** (Valve dynamic dialog, Ruskin GDC 2012). Facts are matched against
   authored rules; specific beats generic; rules write facts back ("already said").
   [GDC Vault](https://www.gdcvault.com/play/1015528/AI-driven-Dynamic-Dialog-through)
7. **A pacing director** (Left 4 Dead). An intensity budget cycling build, peak, relax with
   forced relax windows: a busy stream gets a few strong moments, not nonstop noise.
   [Booth GDC 2009](https://cdn.fastly.steamstatic.com/apps/valve/2009/GDC2009_ReplayableCooperativeGameDesign_Left4Dead.pdf)
8. **Anticipation and outcome reactions measurably help** (Takayama, Dooley, Ju, HRI 2011,
   N=273). Forethought made intent clearer and the robot more appealing; reacting to the outcome
   made it seem smarter. Eyes lead deliberate actions; on surprise the body moves first.
   [PDF](https://www.wendyju.com/publications/151r-takayama.pdf)
9. **The LLM proposes, the system disposes** (SayCan; game practice). Reflexes react instantly,
   utility scoring runs every few seconds, the LLM runs on triggers and picks only what is
   feasible now. Late or invalid output is dropped. Tavi already does this.
   [arXiv](https://arxiv.org/abs/2204.01691)

Other sources consulted: Isla, Halo 2 behavior trees; Unreal event-driven BTs; Mark and Dill,
utility theory (GDC 2010, IAUS); Orkin, F.E.A.R. GOAP; HTN (Humphreys); Creatures (Grand);
Oz/Hap (Bates, Loyall); Facade (Mateas, Stern); Versu (Evans, Short); Comme il Faut / Prom Week;
Perlin's Improv; MIT Synthetic Characters C4; Generative Agents (Park et al. 2023); Cozmo/Vector
(Anki); Aibo, Eilik, Jibo, Moxie; Nintendogs; Animal Crossing personality types; Shimeji;
Desktop Goose; Clippy and Horvitz's mixed-initiative principles; Neuro-sama (public info only);
VTube Studio and Live2D motion priorities; Twitch first-time/returning chatter tags.

Unverified details: two primary PDFs (ALMA, Facade tech report) did not decode, so those
specifics come from abstracts and secondary sources. Neuro-sama's architecture is not public.
Cozmo's procedural-face parameter count comes from reverse engineering.

## Pitfalls we design against

- **Clippy interruptions.** Defer non-urgent bits while the streamer talks or an alert plays;
  default to doing less; one-key dismissal (quiet, retract already exist).
- **Repetition fatigue** ("cute, then silly, then annoying"). No-repeat windows, weighted
  randomness, parameter ranges on every replay.
- **Meters and guilt.** No Tamagotchi obligations. Mood shows only through motion.
- **Echoing chat on stream.** Twitch held Neuro-sama and "Nothing, Forever" responsible for AI
  output. Treat usernames and captions as untrusted.
- **Monetization pressure.** Affection must not escalate with donations.
- **Overload.** Habituate, batch and rate-limit as chat volume grows.
- **Cloud-dependent personality** (Moxie). Core behavior stays local; AI is a bonus layer.

## Target architecture

| Layer                   | Role                                                             | Status                |
| ----------------------- | ---------------------------------------------------------------- | --------------------- |
| Perception / blackboard | Typed percepts with salience; one shared state                   | Partial (`Companion`) |
| Affect (ALMA-lite)      | Emotions, mood, fatigue, boredom, overload                       | **Implemented**       |
| Pacing director         | Intensity budget, build / peak / relax                           | **Implemented**       |
| Arbitration             | Fixed priority: control > manual > streamer > chat > idle        | Existing              |
| Reaction rules          | Most-specific-rule matching over event + context + mood + memory | Next                  |
| Autonomous life         | Utility scoring over idles, anchors that advertise, top-K random | Next                  |
| Execution               | Macro-behaviors -> body states -> procedural motion layer        | Existing              |
| Memory                  | Session facts, then opt-in regulars and running jokes with decay | Later                 |
| LLM advisor             | Closed vocabulary, now with mood as context                      | Existing + mood       |

Avoid: GOAP, full HTN planning, learned behavior, per-tick LLM calls.

## Implemented: affect and pacing

`shared/affect.ts` (pure, clock-injected, deterministic):

- **Appraisal table**: chat, addressed chat, streamer, studio, chat burst, support (small,
  medium, large), raid, moderation, woken -> PAD impulse plus stimulation.
- **Emotion** decays with a 25 s time constant; impulses saturate so floods never pin a value.
- **Mood** follows baseline + emotion with a 150 s time constant. **Baseline** comes from
  personality, attitude and energy (playful rests livelier and bolder than shy; spicy is more
  dominant; gentle more pleasant). Per-personality gains: shy startles more, playful enjoys more.
- **Fatigue** builds over about four awake hours (faster when aroused) and recovers over a
  25-minute nap. **Boredom** and **overload** come from a stimulation level that fades over
  five minutes (Kismet's comfort zone).
- **Snapshot**: quantized to 0.05 and labeled in plain language ("upbeat, a bit sleepy") for the
  studio. Never shown on stream.

How affect changes behavior (shading, never replacing streamer settings):

- `restScale`: multiplies the quiet-time schedule (settle, doze, lie). Tired or bored settles
  sooner; an excited Tavi stays up longer.
- `effectiveEnergy`: the energy the motion layer and expression strength use. Arousal lifts it,
  fatigue drags it down, the configured energy stays the base.
- The AI prompt receives the mood label as context.

`server/behavior/pacing.ts`: automatic reactions (support events, chat-priority reactions,
chat-burst peeks) spend an intensity budget that fades over 75 s. Crossing the peak starts a
relax window (at least 45 s and until intensity falls): reactions play at 55% intensity and
chat-burst peeks wait. Manual, streamer and control cues are never limited.

Service state carries `performance.affect` (null-defaulted, schema-validated). It is published
only when the quantized snapshot changes and does not bump the performance revision.

### See it

Studio, Live view: the **How she feels** card shows the label and meters for joy, energy, boldness,
tired, bored and overwhelmed, updated from the service. Simulated chat and support previews
move it. The legacy motion lab (`tools/motion-lab`) still renders the old Lyla mascot and is not
the current model, so it is not used for this.

## Implemented: autonomous life

`server/behavior/life.ts`: when nothing else is going on, Tavi picks an activity every 20-150 s
(by initiative, personality, energy and mood): wander the stage, visit chat, check on the
streamer at the webcam, watch the game, look around, stretch, play (a dance or hop) or go home.
Each is scored from mood and drives (bored and lively: travel and play; tired: stretch and stay
put; bold: approach the webcam; shy: sneak and keep to the edges). The last activities score
lower and she picks among the real contenders (within 60% of the best), weighted by score
squared. Her walk carries her mood: skip when happy and excited, trudge when tired, amble when
bored, sneak when shy. She gets up from sitting when bored enough; sleep, peeks and perches are
left alone. Nothing happens in quiet mode, while tucked away, while the streamer or a reaction
has the floor, right after a manual pose, or while the pacing director is relaxing. Places are
visited on the scene floor. The Studio's "Last reaction" note shows the choice and top scores.
Reserved initiative stays in place.

## Roadmap

1. **Life tuning and a debug view**: per-activity cooldowns, a commitment bonus, and a score
   panel in the Studio.
2. **Mood in gait and travel mood**: pleasure picks trot vs. trudge; dominance picks approach vs.
   peek. Extension point: `selectGait`.
3. **Most-specific-rule reactions** for stream and support events; subscribe to follows,
   hype trains and opt-in channel-point mischief (poke, dance, snack) with cooldowns.
4. **Attention**: glance at new chat with per-user habituation; first-time and returning chatter
   tags; batch floods into one reaction; "check on streamer" glances during lulls.
5. **Default activity** (Disney's Read state) so idle reads as busy, not waiting.
6. **Memory**: session callbacks (raider, first chatter, top gifter), then opt-in regulars and
   bounded temperament drift the streamer can lock.
7. **LLM**: retrieved memory as context; a deterministic playful "filtered" beat for blocked
   output.

## Side findings

- Doc drift: `AGENTS.md` and `PRODUCT.md` still call AI a future milestone, although a guarded
  AI reaction model exists.
