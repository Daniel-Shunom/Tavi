# Tavi motion audit (baseline)

Audited 2026-10-27 on branch `motion/refinement-pass`, against `.agents/skills/character-motion`.

**Sources:**
- Keyframe measurements from `art/tavi-rive-lab/runtime/scene.rml`, which compiles to `tavi-refined.riv`.
- Real landing-page recordings from headless Chromium (`build/record-landing.mjs`).
- Clip strips from `tools/motion-strips.mjs`.

Strips and recordings are generated under `build/motion-audit/` and are not committed.

Units: the artboard is 600 × 600 and Tavi stands about 480 units tall. Clips run at 60 fps.

## Findings, ranked by how much they hurt on screen

### 1. The walk glides (`tavi/runtime/gait/walk-{left,right}`, 56 frames, two steps)

| Property | Now | Production target (chibi walk) |
|---|---|---|
| Body rise and fall | 4 units (~0.8 % of height) | ~18–30 units, lowest just after contact, highest at push-off |
| Torso (`upper`) tilt or counter-rotation | 0° | A few degrees per step, opposing the hips |
| Upper-arm swing | 20.6° | ~30–40°, opposite the legs, on an arc |
| Forearm drag (`arm*.fore`) | 0° (frozen) | 8–15°, trailing the upper arm by 2–4 frames |
| Head lag or bob | none keyed | Head trails the body by 1–3 frames; a slight nod on the down |
| Step lift and length | 18 lift, ~36 travel | Fine for the size; a touch more lift on the passing pose |
| Spacing | Per-frame linear samples of eased functions | Keep, but favour contact and down (weight) |

The live page confirms it: she turns to a three-quarter view and steps, but her head height and arms barely change, so she reads as sliding. The landing now plays the loop at 1.7 strides/s, which makes the missing weight look like a shuffle.

### 2. Sitting and standing are a straight blend (`tavi/runtime/pose/{perch,floor}-*`)

Each pose is two keys, rest at frame 0 and seated at frame 60. The landing scrubs between them with a smoothstep over 0.55 s, so every part moves in unison:
- no look at the spot and no anticipation;
- the hips don't lead, and there's no squash on contact;
- the arms and legs don't settle with overlap.

Standing up is the same blend reversed. On the live page the change reads almost as a pop.

The seated hold is static. An authored `swing_legs` clip exists in the file, but nothing uses it.

### 3. Starts, stops and turns have no acting (landing `TabletopCompanion`)

- Speed and facing change at constant rates (`approach`), and the gait fades in by speed.
- No lean before starting, no catch-step or settle on stopping, and no head-first turn.
- The authored turn is a subtle three-quarter yaw by design (art constraint), so the acting has to sell it.

### 4. Hair and skirt never react to travel on the landing (from reading the code)

The landing moves the page element, not the motion layer's locomotion. The motion layer therefore sees zero travel velocity, so hair drag (`hairSwing` / `hairSwoop` from `travelVelocity`) and travel lean stay at 0 while she walks.

### 5. The skip's arms are almost still (`tavi/runtime/gait/skip-*`)

Arms move 4.6°, while the body rises and falls a healthy 46 units. A skip without arm pump reads stiff. The overlay uses it when the playful personality picks a skip.

### 6. The sprint is acceptable (`tavi/runtime/gait/sprint-*`)

The body rises and falls 24 units, the arms swing 50°, and the forearms trail by 14°. It only needs polish: a forward lean and head lag.

### 7. Gestures: not yet reviewed visually

The runtime acting clips (`wave`, `celebration`, `thoughtful`, …) key only body and feet. Arm acting comes from the code-driven expression layer (`src/renderer/motion/systems/expressions.ts`, the mascot-v2 acting library). It needs a pass in the studio, where those gestures play.

### 8. Climbing is not on the site right now

The tabletop hero replaced the climb-out-of-the-TV choreography (`heroPerformance.ts` is unused). The lab's climbing clips are not exported as runtime tracks, and the overlay's "climb" entrance is procedural.

## Tooling notes

- `tools/motion-strips.mjs` drives clips through `applyFrame` but not the refined binder's view selection. Its walk strips therefore show the front view, while the site shows three-quarter. Until the harness routes through the binder, judge locomotion from real-page recordings.
- Chrome tabs driven by automation throttle `requestAnimationFrame`, so use headless Playwright for live captures.

## Proposed order

1. Walk timeline (`tools/tavi-rive-lab/locomotion.py` → `runtime_foundations.py`): body rise and fall with weighted spacing, torso counter-rotation, forearm drag, head lag, arm arcs. Keep the 56-frame / 60-unit distance lock.
2. Hair and skirt drag plus travel lean on the landing: feed the page's travel velocity to the motion layer (runtime code, no rig change).
3. Sit-down and stand-up as authored transitions, with a look, anticipation, hips leading, contact squash and a settle, plus a living seated hold (leg swing, breath).
4. Starts, stops and turns: lean-in, catch-step settle, head-first turns.
5. Skip arm pump and sprint lean.
6. A gesture review in the studio.
7. Climbing: only if it returns to the site.
