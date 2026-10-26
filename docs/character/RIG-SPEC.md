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

Reading the editor source (section 1b) corrected three of these limits. The arms already have
elbow bones; the shipped binding only rotated the shoulders. The eyes have pupil shapes, though
the "pupil" set under `eye CONTROL` is hidden. And the "lid" joysticks are the artist's lower-lid
blinks. The other limits still apply to v1.

## 1b. Lyla v2 (the remix) and the v2 rig contract

Lyla v2 (`mascot-v2`) is the same art, rebuilt from the editor source that the user remixed and
the Rive CLI pulled (`art/mascot-remix/`, CC BY 4.0, see its `ATTRIBUTION.md`). The pipeline:

```text
art/mascot-remix/scene.rml      (pulled source plus two build fixes; never pushed)
  -> tools/mascot-remix/author.mjs   authorTavi(rml, spec): Tavi's additions, idempotent
  -> tools/mascot-remix/slim.mjs     character-only copy in art/mascot-v2-export/ (git-ignored)
  -> rive art/mascot-v2-export --once
  -> src/renderer/characters/mascot-v2/mascot-v2.riv (82 KB)
```

`author.mjs` exports `lylaSpec`, which records every component id it touches, plus
`authorTavi(source, spec)`, a pure function. A variant made from the same rig (another
hairstyle, skin tone or face shape) calls `authorTavi` with its own spec, for example other skin
colours or the ids from its own source. Its build then satisfies the same contract, so the
manifest, motion, body states and acting are shared.

### The contract (what every v2-compatible file must provide)

The artboard is `lyla animation`. A CLI build keeps component names, so no in-memory patch is
needed (`patch: { artboard }`).

| Kind              | Name in the file                                                                                                                                                                                                                                           | Manifest handle                      | Meaning                                                                                                                                                 |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Node              | `tavi/footL`, `tavi/footR`                                                                                                                                                                                                                                 | `foot-l`, `foot-r`                   | Foot IK targets (screen-left/right)                                                                                                                     |
| Node              | `tavi/body`                                                                                                                                                                                                                                                | `body`                               | Hips: crouch, rise and shift over planted feet                                                                                                          |
| Node              | `tavi/upper`                                                                                                                                                                                                                                               | `upper`                              | Torso lean                                                                                                                                              |
| Node              | `tavi/head`                                                                                                                                                                                                                                                | `head`                               | Head roll around the neck, head Y                                                                                                                       |
| Node              | `tavi/armL`, `tavi/armR`                                                                                                                                                                                                                                   | `arm-l`, `arm-r`                     | Shoulder rotation (positive raises outward on both sides after binding)                                                                                 |
| Bone              | `tavi/armL.fore`, `tavi/armR.fore`                                                                                                                                                                                                                         | `arm-l-fore`, `arm-r-fore`           | Elbow bend, additive rotation (bones take rotation only)                                                                                                |
| Node              | `tavi/eyes`                                                                                                                                                                                                                                                | `eyes`                               | Pupil look-at target: pupils follow it within 8 u of each eye centre; additive x/y (`pupilX/Y` plus half the gaze)                                      |
| Bone              | `tavi/armL.upper`, `tavi/armR.upper`                                                                                                                                                                                                                       | (reserved)                           | Upper-arm bones (IK roots, if added)                                                                                                                    |
| Control animation | `tavi/faceX`, `tavi/faceY`, `tavi/browLeft`, `tavi/browRight`, `tavi/blinkLeft`, `tavi/blinkRight`, `tavi/lidLeft`, `tavi/lidRight`, `tavi/mouthX`, `tavi/mouthY`, `tavi/mouthCurve`, `tavi/squash`, `tavi/hairSwing`, `tavi/hairSwoop`, `tavi/hairSquash` | `ctl.face-x` … `ctl.hair-squash`     | 60 frames at 60 fps, keying a joystick axis linearly from -1.25 to 1.25                                                                                 |
| Control animation | `tavi/browTiltL`, `tavi/browTiltR`                                                                                                                                                                                                                         | `ctl.brow-tilt-l`, `ctl.brow-tilt-r` | Frame 0 inner end up (sad), 30 rest, 60 inner end down (angry)                                                                                          |
| Control animation | `tavi/mouthOpen`                                                                                                                                                                                                                                           | `ctl.mouth-open`                     | Frame 0 the closed line only; the line hands over to the open mouth (flat on the same curve) by frame 5; frame 60 fully open. Never both mouths visible |
| Control animation | `tavi/mouthWide`                                                                                                                                                                                                                                           | `ctl.mouth-wide`                     | Frame 0 round (O/U), 30 neutral, 60 wide (E); scales the open mouth                                                                                     |
| Control animation | `tavi/handL`, `tavi/handR`                                                                                                                                                                                                                                 | `ctl.hand-l`, `ctl.hand-r`           | Solo selection held from frame 10k: 0 rest, 1 open palm, 2 fist, 3 point, 4 thumbs up                                                                   |
| Control animation | `tavi/armsFront`                                                                                                                                                                                                                                           | `ctl.arms-front`                     | Draw rules: frame 0 arms in natural order, from 30 in front of the hair                                                                                 |
| Clips (authored)  | `hands on hips`, `thoughtful`, `blink 2/3/4`, `wave`, `wave Non Looping`, `celebration`, `testing`, `back and forth`, `blink_IDLE`, `Timeline 2`                                                                                                           | `hands-on-hips`, …                   | Body-language clips the acting and motion layers request by role                                                                                        |
| Appearance clips  | `hair Pink/Orange/Brown`, `clothing green/black/light green`, `glasses blue/white/grey`                                                                                                                                                                    | `hair.pink`, …                       | Colour options                                                                                                                                          |

The binding (`characters/mascot-v2/motion.ts`) samples discrete selections at `(10k + 5) / 60`
s, and samples `armsFront` at 0.01 or 0.99. Body-state geometry (`characters/mascot/states.ts`,
seat height and sole contacts) is shared because the skeleton is identical. A variant that
changes leg or hip proportions must provide its own.

### Where the hair lives (for new hairstyles)

All ids are in `art/mascot-remix/scene.rml`, inside `lyla animation > ALL > TOP > null > ALL_Lyla

> ALL_Lyla > HIP > core > neck > head`:

- **Bangs** (top of the head, front-most in draw order): `bangs move` (`0:1297`) >
  `bangs` (`0:1296`) > shapes `bangs_2` (`0:438`) and `bangs` (`0:447`). The arms' "front" draw
  target is `0:447`.
- **Side pieces** (the tassels that swing): `hair side pieces` (`0:1307`) > `hair side pieces
move` (`0:1306`). There is one bone chain per side: `hair side 2` (`0:2121`) > RootBone `hair
bone right` (`0:2122`) > Bone `hair left swing` (`0:2123`), with the shapes under `hair side`
  (`0:2124`); and `hair side` (`0:2119`) > RootBone (`0:2107`) > Bone `hair right swing`
  (`0:2108`), with shapes under `0:465`. A hidden older chain (`hold` > `hair bone` `0:2105`) is
  unused.
- **Back hair** (behind the head, squashes): `hair squash` (`0:5961`) > `hair BACK` (`0:684`) >
  shapes `Vector 61`–`Vector 73`.
- **Hair dynamics** are the joysticks `hair tassel swing` (`0:2154`, timeline `hair swing`, the
  side bones), `hair back swing` (`0:2292`, `hairswoop`) and `hair squash` (`0:6009`). The motion
  layer drives them through `tavi/hairSwing`, `tavi/hairSwoop` and `tavi/hairSquash`, clamped to
  ±0.25, ±0.18 and ±0.06 because larger values balloon. A new hairstyle keeps the physics if its
  locks are skinned or parented to the two side bones and its back mass sits under `hair squash`.
  Keep the bones and joysticks, and swap the shapes.
- **Hair colour** is keyed by the `hair Pink/Orange/Brown` animations (solid colours and
  gradient stops on the hair shapes). New shapes need keys there, or the runtime recolour.

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

Lyla v2 approximates visemes with two continuous controls: `mouthOpen` and `mouthWide`. Lip sync
can map each viseme to an (open, wide) target, for example A (0.8, 0.2), O (0.8, -0.7),
E (0.45, 0.8), U (0.35, -1) and M (0, 0), and the springs blend between them. A production rig
should go further. Following Duolingo's per-character viseme design guide, use 12 shapes in a `Solo` bound to
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
