# Motion lab

The lab is permanent development source at `/rig-lab`, on the
`research/tavi-rig-fluidity` branch. It is separate from Studio's live stream controls.

```powershell
npm run rig:lab
```

Open `http://127.0.0.1:5175/rig-lab`. The development lab does not need the local service,
Twitch credentials, OBS or AI access. Production builds serve the same route from the
local service. The comparison always uses the same licensed artwork and clock.

## Studies

- Neutral: inspect manual offsets with no automatic body acting.
- Chest / pelvis / neck isolation: one additive control at a time.
- Head stabilization: the head counters chest and neck rotation.
- Body flow: a restrained pelvis/chest/neck sequence with phase offsets.
- Sleep: head support, cheek/torso wrist contacts and restrained chest/neck breathing.
- Sleep settle: acquire those supports, hold, then release without a loop snap.
- Sleep cycle: a 16-second stand/lower/plant/sleep/push-up/stretch/stand study.
- Wake interrupt: interrupt a partial lie-down and wake from the sampled pose.
- Weight shift / support stress: foot support and extension resistance.
- Turn / walk / floor sit / perch sit: compare against existing authored ownership.

Manual offsets affect the candidate only. Values are radians internally and degrees in the
UI. Clear removes manual offsets; select Neutral to remove a study's automatic acting.
Strength scales the animated study. Steady head overrides the study's stabilization.
Pelvis rotation yields during authored lower-body actions, including walking and sitting.
Sleep support owns wrists only while the sleep weight is active. Awake expressions retain
their existing bindings. The ground guide stays hidden: the rig preserves the sampled nap
head origin; it does not scan the drawn hair contour against arbitrary surfaces.

Use Pause and the timeline for fixed poses, Overlay scale for 220 px inspection, and
Ivory or Alpha check to expose seams and transparent fringes. Scrubbing reloads the
instances deliberately so secondary-motion history cannot contaminate pose comparison.

## Checks and artifacts

```powershell
npm run test:rig
npm run check:rig-browser
```

The browser check expects port 5175 by default. Override `TAVI_TEST_URL` to test a built
service. `TAVI_RIG_SCENES` accepts a comma-separated subset of study names for focused
work. `TAVI_SERVICE_URL` explicitly enables Studio/overlay smoke checks against an
isolated service; it temporarily selects the foundation model and restores the selection.
Do not point this option at a streamer's live service.

Screenshots, actual Rive measurements and Chromium logs are written under ignored
`test-results/rig-foundation/`. They are regenerated evidence, not source or approved
artwork. The source, study definitions, test scripts and this guide belong in Git.

`data-rig-diagnostics` on each canvas records the owner, contact error, segment-length
error and support residual. The candidate also reports the bounded body controls actually
applied, sleep-contact weight, wrist/reach residuals and sampled head anchor. Full-contact
checks require wrist error below 0.02 artboard units and a stable head during breathing.
Partial-contact frames intentionally blend toward the contact rather than claiming a lock.
The prop-hand diagnostics include `propWeight` and `groundError`; only a fully owned
plant is tested as a locked contact. The prop target uses the calibrated 600-unit artboard
sole plane and compensates the external body rotation. Authored clips are not measured by the procedural solver; their zero diagnostic
values are placeholders, not evidence of a perfect authored pose.

## Extending the rig

`src/renderer/rig/body.ts` is the reusable articulation component. Its Rive part bindings
are in `characters/tavi-foundation/body.ts`. The virtual parent applies identical pivot
transforms to existing sibling parts, preserving all original draw IDs and depth rules.
`prepare()` restores additive changes before animation sampling; `apply()` runs after
sampling and before contact correction. Do not reverse that order or accumulate offsets.

Add a named time-addressable study in `rig/demo.ts`, tests for its mechanics, and browser
samples. Keep neutral behavior equivalent, retain source-art credit, inspect both sides
and small scale, and classify seam / pop / slide / collapse / flip / drift / occlusion /
loop-hitch separately. Wider angles require authored corrective shapes and review.

See [the foundation plan](RIG-FOUNDATION.md) for remaining hand contacts, limb matching,
corrective artwork and contact-aware performance work. Passing browser checks does not
replace native OBS/Tauri delivery checks.

### Contact atlas and interruption polish

The browser check writes `contact-{held,plant,push-up}-{studio,overlay}-{dark,light,checker}.png`
under `test-results/rig-foundation/`. These candidate-only crops expose hand, elbow and
clothing edges at both review sizes. Wake interrupt now carries the sampled incoming
velocity for 350 ms; support weights remain bounded. Rounded palm-pressure artwork is
still outstanding. Keep those visual findings separate from contact-residual pass results.
