# Tavi rig foundation

Branch: `research/tavi-rig-fluidity`. The existing refined model is the comparison baseline.

## Plan and delivery gates

1. **Reusable mechanics.** Exact two-bone IK, contact support projection, analytic springs,
   velocity-matched transitions, explicit channel ownership. Test singularities, reversal,
   interrupted transitions, large time steps and 30/60/120 Hz equivalence.
2. **Opt-in runtime.** Reuse the approved, script-free refined artwork. Apply the new solver
   only to procedural standing legs; authored walking, sitting and acting retain ownership.
   Keep limb length and contact constraints in pelvis coordinates, not screen pixels.
3. **Comparison lab.** Same artwork, same clock, baseline and foundation side by side.
   Include support stress, weight shift, turns, walking, sitting, small-overlay scale,
   scrubbing and background changes for compositing inspection.
4. **Articulation authoring.** Independent pelvis/chest/neck controls with identity wrappers,
   arm FK/IK matching, hand and foot orientation, and explicit draw-order components.
   Requires neutral-pose pixel parity and a reviewed extreme-pose atlas before promotion.
5. **Corrective library.** Shoulder, elbow, hip, knee, neck and garment overlap shapes;
   three-quarter replacement art; seam and silhouette review at 220 px and 600 px.
6. **Performance library.** Idle → turn → walk → stop → sit → stand, contact-aware phase
   matching, interruptible gestures, breathing and constrained follow-through.

Milestones 1–3 and the independent body-control portion of milestone 4 are implemented.
Hand contacts, FK/IK matching, corrective art and the performance library remain. No claim of production perfection
until the art and actual OBS/Tauri output pass review.

## Component contract

- Artboard units, x right, y down, angles radians; left/right use the existing unmirrored
  rig's screen-side convention. Stage travel is measured in body heights.
- Animation samples establish the pose first. Contact correction runs after them.
- Authored gait and seated limbs own their geometry; procedural solvers must yield.
- Face, limbs, torso and secondary motion are separate channels. Equal-priority writers
  are an error; arbitration cannot silently depend on array order.
- Contact targets are inputs, not spring outputs. Smooth the body's response while keeping
  planted targets fixed. Report residuals when simultaneous constraints cannot be met.
- Springs expose position and velocity. Discontinuities reset explicitly; paused evaluation
  does not advance state. Retargeting starts at the current value and velocity.
- The opt-in model shares the existing licensed asset. No remeshing, artwork replacement,
  dependency change, default-model change or alteration to the baseline binary.

## QA gates

Numerical: reachable IK segment error < 1e-7 artboard units; unreachable targets return a
finite clamped endpoint and measured error; compatible support constraints settle below
1e-5 units; constant-target spring samples agree across frame rates within 1e-8;
transitions preserve start/end position and velocity, including mid-flight reversal.

Visual: inspect neutral, bend extremes, opposite turns, left/right walking, walking-to-rest,
floor/perch sitting and head/arm gestures. Inspect alpha edges on dark, light and checker
backgrounds. Record seam, pop, slide, collapse, flip, drift, occlusion and loop hitch
separately. Passing math tests does not establish seam quality or believable acting.

Use `/rig-lab` for deterministic comparison. Studio/overlay select **Tavi (foundation)**
explicitly. Existing Tavi (refined) remains available as an untouched comparison policy.

## Provenance

Artwork and authored poses are the existing Tavi refined export; its original author,
license and notices remain unchanged. This milestone adds runtime mechanics, not new art.
The body-art decomposition and corrective atlas still need deliberate authoring: a solver
cannot invent hidden surfaces, cloth volume or a convincing shoulder silhouette.

## First milestone implementation

Implemented: `src/renderer/rig/` contains renderer-independent mechanics; the opt-in
`tavi-foundation` manifest shares the exact refined asset via `assetSource`.
`createRefinedPostprocessor(board, true)` selects the new contact/cloth policy. Calling
it without the flag retains the baseline policy. Bend branches are calibrated once from
bind geometry so crossing a hip's vertical cannot flip a knee.

The transition and channel-arbitration primitives are reusable APIs. They do not replace
the application's existing state player or gait blending in this milestone. Chest/neck
separation, hand contacts, corrective artwork and contact-aware gait transitions remain
explicitly scheduled above; they have not been silently approximated with body scaling.

Run locally:

```powershell
npm test -- --maxWorkers=1
npm run build
python tools/skills.py
node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5175
node tools/rig-foundation-check.mjs
```

The browser check measures the actual postprocessed Rive joints, not a separate math
simulation. Its 0.02-unit tolerance allows for float32 world transforms; the pure solver
has the stricter double-precision gates above. Screenshots and measurements go to ignored
`test-results/rig-foundation/`. Native OBS and Tauri validation is still required before
promoting this candidate to the default model.

## Verification record - 2026-10-31

- Full suite: 64 files, 521 tests passed with `npm test -- --maxWorkers=1`.
  The initial concurrent run hit existing subprocess/time limits; the serial run passed.
- Latest mechanics-only run: all 12 tests passed after support-projection refinement.
- Production build, TypeScript, changed-source ESLint, formatting and `git diff --check` passed.
- Skill verification: 17 skills, 200 pinned files verified.
- Production browser: 30 sampled poses, support stress at 150% strength, overlay scale,
  alpha background, mobile layout, and no page errors.
- Procedural contact samples: maximum measured contact error 0.000024 artboard units;
  measured segment-length error and support residual were zero. Authored clips yield to
  their existing geometry and are covered by the existing authoring/runtime tests.
- Built Studio and transparent browser overlay both rendered `tavi-foundation` against an
  isolated local service. The service's original character selection was restored.
- Baseline Rive binary is unchanged. No OBS capture or native Tauri validation performed.

## Articulation milestone

Implemented a reusable `BodyRig` with bounded pelvis, chest, neck and head angles,
head stabilization, pivot composition, neutral restoration and explicit animation/contact
ordering. The Rive adapter applies a virtual parent to existing sibling parts, preserving
all original drawable indices and depth rules. No new binary or art export is required.
The public motion-frame/renderer contract carries optional controls end to end.

The permanent lab now has manual offsets, isolated body studies, combined body flow and
a sleep study. A foundation-only binding correction prioritizes nap over the raised-foot
perch heuristic; the baseline retains its old behavior for comparison. At the articulation checkpoint, sleep breathing was a lab study. The sleep support
milestone below adds a foundation runtime profile and wrist contacts; wider-angle
corrective art and a complete sleep performance remain.

The lab regression changes multiple controls on one live renderer, clears them, and compares
neutral imagery. A maximum four pixels with one channel level of error allows observed GPU
edge rounding (one pixel differed by 1/255); larger changes fail. Geometry restoration is
also tested numerically. The lab guide and npm commands are permanent development source.

### Articulation verification

- Full suite: 65 files, 528 tests passed; focused rig suite: 19 tests passed.
- Production build, changed-source ESLint, TypeScript and pinned-skill verification passed.
- Production browser: all 65 sampled poses across 13 studies passed, plus live-control
  restoration within GPU rounding tolerance, authored pelvis ownership, mobile layout,
  transparent overlay and Studio smoke checks. No page errors.
- Sleep uses the same held nap geometry as the app. The candidate fixes raised-foot
  misclassification; head/hand support calibration and a finished sleep performance remain.

## Sleep support milestone

Implemented on top of the existing expression and body-state pipeline:

- `BodyRig.headSupport` preserves the sampled head origin while the chest/neck breathe.
- Reusable two-bone wrist targeting matches the closest FK elbow and blends rotations over
  the shortest angle. No bone length, scale, drawable ID or source asset is changed.
- The foundation nap places the left wrist at the cheek and right wrist at the torso.
  Targets are calibrated in the existing art's head/shirt coordinates. Finger/palm pressure
  and wider-angle elbow correctives remain art tasks.
- Whole-body sleep squash and foot twitches yield to the held silhouette. Small C2-continuous
  chest/neck motion replaces them; reduced motion suppresses that breathing motion.
- `PlayerResult.napSupport` carries source-state contact weight through wake-up even after
  the requested state changes to stand. It fades with the existing sleep envelope, keeping
  the service's event/expression IDs, cooldowns and personality rules unchanged.
- The lab adds a deterministic Sleep settle study; full standing-to-lying choreography still
  comes from the existing state planner. Head support preserves its sampled pose reference,
  not a newly measured hair-to-floor silhouette.

The compatibility sweep covers all 49 existing awake expression IDs. Contact metrics are
measured in the actual Rive renderer; the pure solvers also cover mirrored parent spaces,
FK matching, reachable lengths, loop boundaries and support release.

### Sleep verification

- Full suite: 66 files, 585 tests passed; subsequent focused rig suite: 76 tests passed,
  including a shared-clock reconnect check.
- All 49 awake expression bindings match the existing binder. Wake-up source-state support,
  fixed head origin, mirrored contact math, loop endpoints and reduced motion are covered.
  Breathing uses service time rather than local mount time so reconnecting preserves phase.
- Production build, TypeScript, changed-source ESLint and pinned skills passed.
- The real Studio flow enters nap, reconnects a transparent overlay into the held pose,
  wakes without dropping support immediately, then triggers a normal gesture successfully.
- A pre-existing Studio condition incorrectly disabled changing posture at the same spot.
  The dock now suppresses redundant same-state commands while allowing Stand → Nap there.
- The baseline model and artwork binary are unchanged. Native OBS/Tauri capture and a full
  joint-corrective atlas remain delivery gates.

- Production browser sweep: 70 poses across 14 studies passed, including full-contact wrist
  residuals and stable supported-head anchors. The live nap/reconnect/wake/gesture flow passed.

## Complete sleep-performance checkpoint

The foundation StateRig opts into a support-aware nap plan. The baseline keeps its existing
plans. Entry now stages a weight shift, controlled lowering, hand acquisition, supported
pause, lowering to the head and final settle. Normal wake plants the hand before push-up,
pauses, releases it, stretches, then rises. Urgent wake takes a shorter supported route.

`KeyPose.handSupport` blends independently of sleep/face ownership. The wrist adapter can
blend a calibrated floor plant into the cheek contact, compensating the external canvas
rotation. Nap's seated corrective track now fades its foot offsets toward the lying pose
rather than dropping those offsets when the ownership mode changes.

For the supported rig, exit and same-spot wake plans may start at the actual sampled pose.
The live state player supplies that pose on interruption; a raid during lowering no longer
assumes the character has already reached the fully sleeping key. This guarantees matched
position; arbitrary incoming velocity matching and final contact-shape art remain polish.

The preserved lab includes Sleep cycle and Wake interrupt, with a longer timeline for the
full cycle. Unit checks cover support ordering, end states, sampled interruption matching,
live-player continuity, bounded values and reduced-motion bypass. The existing expression
compatibility sweep remains in place. No source binary, default character or event routing
has changed. Elbow/hand pressure shapes and the extreme-pose atlas remain an artwork pass;
this checkpoint does not claim that those corrections have been authored.

Checkpoint validation: 67 files / 592 tests passed; focused rig suite 82 passed. Production
build, ESLint, formatting and 17 skills / 200 pinned files passed. The production browser
verified 19 new performance poses, planted-wrist residuals, Studio nap, overlay reconnect,
wake release and post-wake gesture. Next: joint/clothing corrective artwork, final motion
polish, and native OBS/Tauri review. Resume from this document and RIG-LAB.md in a new thread.

## Final pass: sleep leg projection and native smoke review

The foundation's held sleep mode now uses the same exact-length, fixed-bend two-bone
projection as its standing solver. The previous sleep fallback shortened the projected
segments independently and produced sharp changes in width around the knee. Authored
walking and seated geometry still own their poses; the baseline policy is untouched.
The browser regression explicitly requires contact-solver ownership for held sleep and
checks actual Rive endpoint and segment-length residuals below 0.02 artboard units.

Review progress:

- Full browser atlas before this change: 89 sampled poses passed.
- Sleep projection candidate: 29 sampled sleep/settle/cycle/interruption poses passed;
  focused mechanics suite: 82 tests passed. Production build passed.
- OBS 32.1.2: created a separate `Tavi Rig QA` scene collection with a browser source at
  `http://127.0.0.1:4323/overlay`. Confirmed live mascot-to-foundation replacement and
  rendered nap/standing states in the actual OBS canvas. The window subsequently closed;
  colored-background alpha, refresh and final capture review remain pending.
- Desktop packaging exposed an existing credits collector bug: nested asset credit folders
  were read as files (EISDIR). The collector now includes nested credits; its Node regression
  test passed. The complete Tauri debug build passed after the fix. This is build evidence,
  not a completed native rendering gate: the debug shell hardcodes port 5173, which is
  occupied by other work, so it was not launched against that unrelated server. No installed
  app or shared service on port 4318 has been replaced.
- Full suite after the sleep fix: 67 files / 592 tests passed. The subsequent saved-settings
  round-trip regression passed with all 7 configuration-migration tests: Refined to Foundation
  and back preserves appearance, name, personality, energy, placement and remaining config.
- Live browser recheck: 24 sleep/cycle/interruption poses plus Studio nap, overlay reconnect,
  wake support release and post-wake gesture passed. Pinned skills and changed-source lint passed.

Remaining promotion gates: review hand/elbow and garment pressure silhouettes, finish
motion interruption polish, complete OBS alpha/refresh checks and real Tauri rendering.
Foundation remains explicitly selectable until those checks pass. Existing saved character
choices need an explicit swap; a new default must not silently overwrite those choices.
