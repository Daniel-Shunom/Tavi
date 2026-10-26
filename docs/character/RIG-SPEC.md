# Mascot rig: limits today and spec for a production rig

Part 1 documents what the shipped `mascot.riv` (alisketch, CC BY 4.0, artboard `lyla
animation`) can do, measured with `tools/expression-sheet/probe.mjs`. Part 2 is a spec a Rive
artist can build to, so Tavi's faces reach Duolingo-level quality without code changes: every
name below is what our manifests consume. Background: `DESIGN-RESEARCH.md`.

## 1. The current rig

### How we drive it

The file was authored through 14 joystick axes plus bone and node transforms. Exported files
strip names and the low-level runtime has no joystick API, so the motion layer patches the file
**in memory**: it adds runtime names to seven nodes and one-property "control track" animations
per joystick axis (`src/renderer/motion/rive/patch.ts`, `characters/mascot/motionRig.ts`). The
`.riv` on disk is never modified. The face layer writes abstract channels; the mascot's binding
(`characters/mascot/motionBinding.ts`) maps them to the control tracks.

### Channels, probed meaning and safe range

| Channel (face layer) | Joystick / node    | What it does on this rig                                            | Safe range             |
| -------------------- | ------------------ | ------------------------------------------------------------------- | ---------------------- |
| gazeX / gazeY        | face x/y (704)     | Turns the whole face plane (eyes, glasses, nose, mouth). No pupils. | -1..1                  |
| browL / browR        | brow joysticks     | Vertical only: -1 high arch, +1 down onto the glasses rim.          | -1.25..0.85            |
| squintL / squintR    | lid joysticks      | Lowers the upper lid (flat top edge): heavy, suspicious, sleepy.    | 0..0.9                 |
| blinkL / blinkR      | blink joysticks    | Lash line down; partial values read as happy or sleepy eyes.        | 0..1                   |
| smile                | mouth curve        | -1 frown, 0 slight smile (rest), +1 broad smile.                    | -1.25..1.25            |
| mouthX / mouthY      | mouth x/y          | Slides the curve sideways; lowers and widens (up = small, pursed).  | -1..1                  |
| squash               | squash/stretch     | Whole-head volume: -1 stretched tall, +1 squashed.                  | -0.9..0.7              |
| headTilt / headY     | head node          | Roll around the neck; head down/up (body heights).                  | ±0.24 rad, ±0.03       |
| lean                 | upper (torso) node | Torso lean over the feet.                                           | ±0.13 rad              |
| bob / shift          | body (hips) node   | Crouch/rise and sideways, feet planted by IK.                       | ±0.04, ±0.035          |
| armL / armR          | arm nodes          | Raise outward; ~1.4 horizontal, ~2 overhead; past ~2.2 behind hair. | -0.4..2.45 (use ≤1.75) |
| footLY / footRY      | foot IK targets    | Lift a foot (knee up).                                              | 0..0.06                |

Authored clips used for body language (roles in `motionBinding.ts`): hands on hips, hand to chin
(`think`), hand behind the head (`sheepish`), palms-out shrugs, wave, wink-wave with a back-kick,
arm swing, celebration.

### Limits (why some expressions are approximations)

1. **Mouth**: one stroked curve. No open mouth, teeth, tongue or lip shapes, so there is no lip
   sync and no visemes. Shock, laugh and yawn read through a lowered, widened curve plus body.
   At 220 px the mouth is about 6 px wide.
2. **Brows**: vertical translation only. No inner/outer tilt, so angry (inner down) and
   sad/worried (inner up) are not available; they read through height, lids and mouth. Below
   about +0.85 the brows vanish behind the glasses.
3. **Eyes**: no pupils or highlights to aim, so gaze turns the whole face. No lower lid, so no
   cheek-raised (Duchenne) smile eyes; happy eyes use a partial blink. No wide-eyed (upper lid
   raised) shape.
4. **Head**: roll only. No pitch (nods move the face plane and head Y) and no yaw (turns are the
   face plane).
5. **Hands**: no hand poses. Pointing, hands to the face, fists and palms come only from authored
   clips, and the arms collide with the hair overhead.
6. **Cheeks**: fixed blush colour; no blush control.
7. **Hair**: three joystick channels (swing, swoop, squash) that balloon outside a narrow range
   (the motion layer clamps them to ±0.25, ±0.18, ±0.06). No bone chain.
8. **File**: an empty embedded script logs `Blank Script 1:1: module must return a value` on
   load; the "wave testing folio header" clip rescales the artboard.

### Patch-level fixes considered

The in-memory patch could also rescale joystick ranges or constraint strengths. The rig needed
no range patch: safe ranges live in the manifest (`face.ts` channels), and the face layer clamps
to them. Nothing in the patch can add missing shapes (inner brow tilt, open mouth, pupils): those
need new art. Using the remixed editor file (`docs/character/RIVE-CLI.md`) is the way to add them.

## 2. Spec for a production rig (Duolingo-style)

### Principles

- One artboard per character, with the **head as a nested artboard** (as Duolingo's Lily does),
  so face and body animate independently.
- Every control is a **view model number** (data binding), not a state machine input. Joystick
  axes and blend states bind to it. The names are the face layer's channel names, so a new
  character needs no code.
- Every control has a neutral at 0 and authored extremes at ±1 (or 0..1), with nothing breaking
  out to ±1.25.
- The rest pose is an animation called `rest` that keys every control to neutral.
- No embedded scripts unless required. If there are any, sign the build (`rive --publish`).

### View model `Tavi` (numbers; ranges in brackets)

Face (head artboard):

| Name                  | Range | Shape at the extremes                                                       |
| --------------------- | ----- | --------------------------------------------------------------------------- |
| `gazeX`, `gazeY`      | -1..1 | Pupils move within the eye whites (translation constraint), face turns ~20% |
| `browInnerL/R`        | -1..1 | Inner end up (sad, worried) .. down (angry, focused)                        |
| `browOuterL/R`        | -1..1 | Outer end up (surprise) .. down                                             |
| `browL/R`             | -1..1 | Whole-brow height (kept for compatibility)                                  |
| `lidUpperL/R`         | -1..1 | Wide (shock) .. lowered (heavy, suspicious)                                 |
| `lidLowerL/R`         | 0..1  | Cheek-raised lower lid (genuine smile, squint)                              |
| `blinkL/R`            | 0..1  | Closed; fully closed bends into a happy arc when `smile` > 0.5              |
| `smile`               | -1..1 | Mouth corners down .. up                                                    |
| `mouthOpen`           | 0..1  | Jaw open with mouth interior, teeth and tongue                              |
| `mouthX`, `mouthWide` | -1..1 | Slide; pursed (oo) .. wide (ee)                                             |
| `viseme`              | 0..N  | Solo of mouth shapes (see below); overrides smile/open while speaking       |
| `cheekBlush`          | 0..1  | Blush opacity                                                               |
| `squash`              | -1..1 | Head stretch .. squash (volume-preserving)                                  |

Body:

| Name                                | Range | Notes                                                                                         |
| ----------------------------------- | ----- | --------------------------------------------------------------------------------------------- |
| `headTilt`, `headPitch`, `headTurn` | -1..1 | Roll, nod and yaw, ±20°; yaw swaps to a 3/4 head view beyond 0.6                              |
| `lean`, `bob`, `shift`              | -1..1 | Torso lean, hips crouch/rise and sideways; feet stay planted via IK                           |
| `armL/R`                            | -1..1 | IK target travel, so hands reach hips, chin, cheeks and overhead without passing through hair |
| `handL/R`                           | 0..N  | Solo of hand poses: relaxed, fist, open palm, point, thumbs up, wave                          |
| `footLY/RY`                         | 0..1  | Foot lift                                                                                     |
| `hairSwing`, `hairBounce`           | -1..1 | Bone chain (3–4 bones per lock) bent by a joystick; we drive it with springs                  |

### Mouth shapes (visemes)

Following Duolingo's per-character viseme design guide, use 12 shapes in a `Solo` bound to
`viseme`: rest (closed), A/I, E, O, U/W, F/V, L, M/B/P, S/Z/T/D, TH, R and a smile-closed rest.
Design each one to be readable at 220 px and in the character's style. Use 2-frame blends for
transitions (an additive blend on `mouthOpen` works too). Map TTS viseme events (Azure's 22 or
Polly's) to these 12 in code.

### State machine layers (fallback for runtimes without data binding)

1. `body`: idle and choreography poses (inputs `speed`, `direction`).
2. `face`: an additive blend state over all face numbers above.
3. `mouth`: visemes (Solo) and `mouthOpen`.
4. `blink`: a one-shot blink trigger plus `blinkL/R`.
5. `overlay`: accessories and attachment sockets.

Order the layers so mouth and blink sit below face and win on shared properties.

### Naming conventions

- Nodes, bones and sockets the code reads: `tavi/head`, `tavi/upper`, `tavi/body`, `tavi/armL`,
  `tavi/armR`, `tavi/footL`, `tavi/footR`, `tavi/socket/<name>` (hat, glasses, held item). The
  current patch adds exactly these names at runtime.
- Clips we play as body language: `tavi/clip/<role>` (hips, think, sheepish, shrug, wave,
  celebrate, walk, climb). Clips must not key face controls, so the face layer owns the face.
- Appearance clips: `tavi/look/<slot>/<option>` (hair, outfit, glasses colours).
- Everything else is free for the artist.

### Acceptance checks we will run

`node tools/rive-inventory.mjs <file>`, the face probe (`tools/expression-sheet/probe.mjs`) and
the expression sheet at 220 px. Every control must move something visible across its whole range
with no popping, intersections or ballooning, and every expression in `shared/expressions.ts`
must be recognisable from the face alone at 220 px.
