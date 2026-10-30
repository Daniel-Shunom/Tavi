---
name: character-motion
description: Tavi's character-animation quality bar and workflow. Use when refining how Tavi walks, runs, skips, turns, sits, climbs, gestures, idles or reacts, whether in the authored Rive timelines (tools/tavi-rive-lab builders) or the runtime motion layer (src/renderer/motion, character binders, landing choreography). Covers acting principles, cycle anatomy, timing targets, the authoring pipeline and its contracts, and a review checklist.
---

# Tavi character motion

Project-local skill (original to this repository). Pair it with `.agents/skills/2d-character-rig-animation` for rig contracts and `.agents/skills/rive` for Rive CLI/runtime lookups. Facts about the pipeline below were read from this repository on 2026-10-27; re-read the named files before relying on them.

## The bar

Tavi should read like a production mascot (Duolingo's Rive characters are the reference; see `docs/character/DUOLINGO-RIVE-REFERENCES.md`): clear silhouettes, snappy timing with real holds, visible weight, and follow-through on everything soft. Lively is not the same as busy. Every motion needs a readable intent, a beginning, and a settle.

Signs of motion that is not there yet:

- even, linear spacing (robotic) or symmetric ease-in-out everywhere (floaty);
- body height that barely changes during a walk, so it glides;
- arms and hair moving in lockstep with the body (no overlap);
- poses that hit and freeze, or never hold long enough to read;
- turns, sits and stops without anticipation or overshoot;
- every repeat identical (no variation where a person would vary).

## Principles applied to a small, big-headed character

- **Squash and stretch:** keep volume. Use the body on contacts and landings and the head on takes. Chibi proportions tolerate more than realistic ones, but the face must stay on-model.
- **Anticipation:** a small opposite move before any large one: dip before a hop, lean back before a turn, a look before a sit or climb. Usually 3–8 frames at 60 fps for a small action and 10–20 for a big one.
- **Timing and spacing:** fast out, slow in. Snappy acting comes from favouring the destination (ease out of the start and cushion into the pose), not from uniform easing.
- **Overshoot and settle:** land past the pose and come back, by a few percent and in one or two decaying beats. One clean overshoot reads as alive; ringing reads as jelly.
- **Arcs:** hands, head and feet travel on arcs, never straight between keys. Check the hand path during arm swing and gestures.
- **Overlapping action and drag:** the head lags the body by 1–3 frames. Hair, skirt and hands lag their parents and overshoot when the parent stops.
- **Secondary action:** blinks on big head turns, a hair flick on a stop, a small smile on an arrival. One at a time, and never fighting the primary action.
- **Holds:** a moving hold, with breath and tiny drift, after each significant pose. It should last long enough to read: roughly 0.3–0.8 s on the landing, longer on stream.
- **Asymmetry:** avoid twins (both arms or both feet doing the same thing at the same time) unless it is a deliberate gesture.

## Cycle anatomy

**Walk (one step = contact → down → passing → up → next contact):**

- **Contact:** heel strikes, legs at widest, body at middle height, arms at full swing opposite to the legs.
- **Down:** weight lands, so the body is at its lowest, knees bend, squash slightly, and the head is still travelling down (lag).
- **Passing:** the free leg passes the support leg and the body rises.
- **Up:** push off, the body is highest and stretches a touch, and the head peaks a frame or two later.
- **Hip and shoulder counter-rotation:** the hips tilt toward the free leg, and the shoulders oppose the hips.
- **Vertical travel is what makes a walk look grounded.** For a chibi body, the down-to-up range should be clearly visible: several percent of body height, not a pixel or two.
- **Cadence sets the mood.** A cheerful walk is bouncier and slightly faster per step, with springy ups. A tired walk has a lower up, a longer down, and heavier contacts.

**Run or skip:** add a flight phase, a deeper down on landing, a forward lean, and stronger arm pump. A skip is step-hop on each side, with a lighter, higher up and a playful head bob.

**Turn:** anticipate (shift weight, tilt the head the opposite way), let the eyes and head lead the body, and overshoot the facing slightly, then settle. A turn through front view should not stall at the midpoint.

**Sit or perch:** look at the spot, turn to it, anticipate (a small rise or lean), lower with the hips leading and ease in, contact with a little squash, then settle the legs and arms with overlap. Getting up reverses this, with a push and a lean forward before rising.

**Climb:** reach (the hand leads), grip (a short hold), pull (the body rises on an arc, legs dragging), then plant the knee or foot and push to stand. Weight transfer must be readable at each phase, and nothing floats.

**Gestures and arms:** start with the shoulder, then the elbow, then the hand (successive breaking of joints). Wave on arcs with a decelerating last cycle. Return to rest with drag, not a snap.

**Idle:** a breath cycle of about 3–5 s, weight shifts, blinks with variable spacing, occasional glances. Keep amplitude small but never zero.

## Where the motion lives

**Authored timelines (Rive):**

- `tools/tavi-rive-lab/build.py` rebuilds the workspace under `art/tavi-rive-lab/`.
- `locomotion.py` (walk), `gaits.py` (sprint and skip), `seating.py`, `ground_seating.py`, `climbing.py`, `rear_climbing.py`, `turns.py` and `shoulders.py` generate review clips.
- `runtime_foundations.py` extracts the runtime loops and poses: `tavi/runtime/gait/{walk,sprint,skip}-{left,right}` and `tavi/runtime/pose/{perch,floor}-{front,left,right}`.
- The `check_*.py` scripts assert the contracts (grounding, contacts, coverage).

**Runtime:**

- `src/renderer/characters/tavi-refined/` contains the manifest, `motion.ts` (binder, authored cycle lengths and strides) and the postprocessor.
- `src/renderer/motion/` contains the procedural layer: gaze, blink, idle, fidget, expressions, locomotion and choreography.
- `src/landing/` contains the page choreography (`tabletop.ts`, `heroGaze.ts`).

## Contracts that must survive a refinement

- **Rig structure is untouched.** Change timelines (keys, timing, curves) only, never parts, bones, constraints or draw order. If a motion seems to need a rig change, stop and ask the user.
- **Distance lock.** A gait loop's travel must equal the stride the runtime assumes. `refinedMotion.authoredCycles` in `tavi-refined/motion.ts` sets walk 56 frames / 60 units, sprint 40 / 104 and skip 96 / 160. The landing uses `STRIDES_PER_SECOND` with `(60 / 600) * unit` per stride. If cadence or stride changes, update both sides together and keep the feet free of sliding.
- **Stance feet stay planted in world space.** Swing feet lift and land with zero velocity at contact.
- **Loops are seamless.** Frame 0 and the last frame match in pose and velocity.
- **Views.** Left, right and front variants must agree in timing so view switches do not pop.
- **Reduced motion** keeps a calm, readable alternative.

## Workflow

1. Capture the baseline before changing anything: sample the current clip with `tools/rive-clip-sampler.mjs` or the landing/avatar-lab in a browser, and record frame strips.
2. Name the defect against the principles above. Fix one property at a time (spacing, then amplitude, then overlap).
3. Edit the builder, rebuild with `python tools/tavi-rive-lab/build.py`, then run `rive <project> --verify` and the relevant `check_*.py` scripts.
4. Compare before/after frame strips at the same frames, then judge in motion in a real browser at 30 and 60 fps.
5. Run `npm test`, `npm run build` and `python tools/skills.py`.
6. Report each clip changed, what changed, and the evidence. Never claim a motion is better without showing it.

## Review checklist

- [ ] The silhouette reads in every key pose.
- [ ] Spacing favours the destination, and holds read.
- [ ] Anticipation precedes every large action, and an overshoot and settle follows it.
- [ ] Body height changes visibly through the gait; contacts show weight.
- [ ] Arms oppose legs, hands move on arcs, and elbows and hands lag the shoulder.
- [ ] The head lags the body; hair and skirt drag and settle.
- [ ] No foot sliding, no popping between views, and loops are seamless.
- [ ] Personality is visible (playful: bouncier and quicker; cozy: softer and slower).
- [ ] The reduced-motion alternative is still readable.
