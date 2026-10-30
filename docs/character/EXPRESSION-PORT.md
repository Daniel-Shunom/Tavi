# Facial expression port on the refined 2D rig

The current port provides the facial component of 34 existing Tavi emotes,
plus neutral, on the isolated `art/tavi-rive-lab` model. Each has subtle,
typical and strong endpoints: 105 complete facial poses and 210 separate
continuous-face / discrete-mouth clips. The seven-state expression lab,
movement previews, original source, and fallback runtime asset are preserved.

The catalog is exported from `mascotV2Face.poses`, rather than inventing a
second expression vocabulary. `expression-catalog.json` records five source
hashes and any channels deferred to body or attention systems. Regenerate it
with `npx tsx tools/tavi-rive-lab/export-expressions.mts` after changing the
canonical acting library.

## Standalone native review

Generator integration, after `sample`, `animation`, `new_id` and
`write_project` have been defined:

```python
from expressions import create_expression_review

create_expression_review(
    board, sample, animation, new_id, write_project,
    WORK / 'expression-catalog',
)
```

The builder copies the board internally. Keep this call outside other project
builders so the 210 port clips and selector graph are not copied into every
motion or seated preview. It creates named clickable expression buttons and
SOFT (35), BASE (60), STRONG (100) controls. NEUTRAL explicitly resets the face.
The catalog review keeps its own facial inputs and does not change body pose,
orientation or gaze. Its default view is front; deterministic endpoint review
also supports both three-quarter directions.

Without modifying the main generator:

```powershell
python tools/tavi-rive-lab/expressions.py --catalog-review --output build/expression-catalog-review
rive build/expression-catalog-review
```

For a held close-up:

```powershell
python tools/tavi-rive-lab/expressions.py --pose sad --level typical --view left --output build/expression-port-review
rive build/expression-port-review --screenshot=build/expression-port-review.png --advance=10
```

Add `--library` to a held review to include every ported endpoint for native
compile/inspection. To append only the reusable clips to another isolated
board copy, call `append_expression_library(board, sample, animation)`; its
return value maps expression, strength stop and face/mouth part to clip ID.

## Layering and readability

- Continuous face clips own only brow, lid, blink and mouth deformation controls.
- Mouth selection clips exclusively own the mouth Solo and original closed-line
  visibility. Do not blend that closed line over an open mouth.
- Positive brow travel is limited to 0.35 in this rig so lowered brows remain
  readable above the large glasses. Tilt and lids retain the attitude cue.
- Blink and lid values use the corrected native conventions from the current
  expression lab, rather than the obsolete runtime mapping.
- The original hair, face, glasses, eye whites, pupil attachments and palette
  remain in place. No external character artwork was copied.

## App runtime integration

Select **Tavi (refined)** in Character at `http://127.0.0.1:5173/studio`.
The synchronized overlay is `http://127.0.0.1:5173/overlay`. Port 5173 is the
development origin trusted by the local service. Restart the service after
registering a new character; a stale service catalog can reject its selection.
The original `mascot-v2` character remains selectable as the fallback.

`tools/tavi-rive-lab/runtime.py` exports the script-free refined asset into
`src/renderer/characters/tavi-refined/tavi-refined.riv`. It contains the full
facial endpoint library, weighted clothing, helper leg bones, and isolated
seated garment correctives. Script-free local exports do not need signing;
`--publish=local` requires a Rive login and is unnecessary for this asset.

The new manifest reuses the canonical `mascotV2Face` acting library, including
onsets, timed keys, mouth choices, pupil performances and gaze/head accents.
These run through the existing FaceLayer and MotionLayer rather than being
replaced with held catalog endpoints. The same Performer, idle scheduler,
attention, quiet mode, retraction and service event cues drive the new model.
The pupil binding targets `tavi/pupil-offset` in screen space; authored left
turns must not flip its X a second time. Brow travel is calibrated in the
binder while semantic expression ranges remain unchanged.

Old gesture clips are split on export: arm rotations remain in their original
handles, while hip translation/rotation, foot targets and IK bend choices get
separate `runtime.acting.*` handles. The latter run only for standing acting;
they yield during travel and seated states. Per-leg scale keys, facial keys
and old draw rules are excluded. Expression legs blend to the original native
IK knees instead of being forced through the parallel-calf walking policy.
Only forearm overlays rise in front of the hair; shoulders remain underneath
the weighted shirt. The old fallback gait clips are excluded.
`runtime_foundations.py` packages the approved lab's walk, sprint/run and skip
into left/right cycles. It extracts interior pairs of steps and converts the
review's moving root to a distance-locked in-place reference; it does not author
replacement poses. Character-specific stride/duration metadata drives travel.
The runtime leaves those authored knee projections intact. Both views are
authored: the refined character is never mirrored as a whole.

BodyStatePlayer retains transition timing and surface ownership. Perch/floor
poses in front/left/right views come directly from the approved lab, including
body, shoulder, elbow, shoe, garment and projected-knee keys. Foundations own
these parts during travel/sitting. Expressions yield their lower-body keys
and layer facial/upper-body acting on that foundation. Side perch retains the
native IK chain; only standing acting uses the expression leg correction.

Run `python tools/tavi-rive-lab/check_runtime_foundations.py` to verify all
twelve directional motion/pose foundations, cycle seams, stance contacts and
seated endpoints. `check_walk_calves.py` retains the no-crossing walk check.
Never replace these foundations with procedural poses when adding expressions.

Studio and overlay share the registry and renderer. Development character and
motion changes force a full reload: React refresh otherwise preserves an
Avatar effect holding an old rig closure or loaded Rive bytes. Canvas data
attributes record `characterId`, `characterAsset`, `rigViews` and the active
`motionFoundation` for parity checks without visible debug UI.

The rear climbing and full-turn authoring previews remain lab work. Custom
variant/attachment index maps from the old binary are not applied to this new
binary; those advanced appearance options remain supported by the fallback.
Palette clips are retained. This integration does not claim every inherited
gesture has received a new artistic polish pass, or that OBS/Tauri have been
retested by browser verification.

Run `python tools/tavi-rive-lab/check_expressions.py` to check provenance,
complete property sets, facial-only ownership, exclusive mouth visibility,
and the full library mapping. Native full-library verification and inspection
passed with zero errors, warnings or problems. Representative inspected
renders: front skeptical, left sad, right strong excited, and front shocked.

Original character attribution remains in
[`art/tavi-rive-lab/ATTRIBUTION.md`](../../art/tavi-rive-lab/ATTRIBUTION.md).
