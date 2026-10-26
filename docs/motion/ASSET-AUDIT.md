# Rive asset audit (motion)

Produced with `tools/riv-inspect/inspect.mjs <file.riv> [--json]`, an offline parser that uses rive-runtime's generated type/property registry (pinned commit `0f4fa96`, regenerate with `tools/riv-inspect/gen-defs.mjs`). Semantics were verified visually with `tools/motion-lab/probe.mjs` (Playwright screenshots of each channel/node at its extremes).

## Main character: `characters/mascot/mascot.riv`, artboard `lyla animation` (600x600)

- 39 linear animations at 60 fps; one state machine (`State Machine 1`) with no inputs (it uses view-model conditions for the original customizer UI); view models exist only for the UI buttons.
- Rig: 53 nodes, 7 root bones + 7 bones, 2 IK constraints (legs), 10 translation, 9 distance, 1 transform constraint, 16 skins, **14 joysticks**.
- **Component names are stripped in the export** (196 of 7,782 objects are named, all animations/artboards). `artboard.node()/bone()` cannot find anything without help.
- **Why the face "looked inactive":** every expressive channel is a joystick that maps its x/y onto a 1 s channel timeline, and the runtime re-applies joysticks at mix 1 on every update. Applying `face x`, `brow left` etc. directly is overwritten by the joystick on the next advance. The performance clips animate the joystick values, not the channel timelines.

| Joystick (component #) | Channel timeline                   | Verified meaning (-1 .. +1)                        |
| ---------------------- | ---------------------------------- | -------------------------------------------------- |
| 704 x / y              | face x / face y                    | look left .. right / up .. down (2.5D head turn)   |
| 697 y, 693 y           | brow left, brow right              | raised .. furrowed, per side                       |
| 700 y, 702 y           | blinks left, blinks right          | open .. closed, per eye (rest -1)                  |
| 705 y, 703 y           | lower lid left/right               | squint/smile eyes .. relaxed (rest +1)             |
| 696 x / y              | mouth X / mouth Y                  | mouth slides sideways / up-down                    |
| 699 y                  | mouth smile frown                  | smile .. frown/"o"                                 |
| 698 y                  | squash stretch                     | stretch .. squash (about +-4-8%)                   |
| 695 x, 701 x, 692 y    | hair swing, hairswoop, hair squash | secondary hair (plausible only within about +-0.2) |

Addressable nodes after naming (component index, role): 3 and 4 foot IK targets (screen-left/right), 8 hips (crouch/rise/shift with planted feet; scaling squashes the body), 9 upper body lean, 11 head roll at the neck, 672 and 658 arms (raise outward), 26 face group, 303 hair group.

**Fix without the editor:** `motion/rive/patch.ts` patches the file in memory at load: it adds runtime names to those nodes and appends one tiny "control track" animation per joystick axis that keys only that value (-1.25 .. 1.25 over one second). Scrubbing a control track sets the joystick exactly; its mix blends over the clips. Existing animation indices are unchanged, the source file is untouched, and `expectTypes` guards against a different export.

**Limits (need the Rive editor):** no walk/run/hop cycle; no head pitch bone (nods are faked via face y plus the head node); the mouth is tiny at stream size (grimace/visemes barely read); no hand/finger poses; `wave testing folio header` rescales the artboard; no clip mask for climbing in the renderer (the hook fades instead).

## Other assets (experiments, reference only)

| File                            | Artboards                                | Notes                                                                                                                              |
| ------------------------------- | ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `toon-creator.riv` (JcToon)     | Avatar + 13 UI artboards, 141 animations | Rich numeric SM inputs (`numBodySize`, `numBodyEyes`...), 4 root bones. Good model for data-driven customization; non-human style. |
| `character-customizer.riv`      | 1 artboard, 20 animations                | Bool inputs (`Smile_Controll`, hat/glasses/mustache toggles); head-only.                                                           |
| `rive-avatar.riv` (nasmith)     | 4 artboards, 59 animations               | Pixel head built on scripted path effects and nested artboards; no body.                                                           |
| `mascot.riv` (experiments copy) | same file as the main asset              | Includes the customizer UI artboards.                                                                                              |

None has walk/run cycles or leg rigs other than the main mascot's IK legs.

## Authoring spec for a proper rig

See the "Authoring spec" section of `RESEARCH.md`: exported names, bone list with leg/arm IK targets, a `Tavi` view model, a layered `Motion` state machine (Locomotion 1D blend on `speed`, Body, Arms, Face additive, Blink), the clip list (walk/run/hop cycles with measured stride, turn, start/stop, fall/land, dust-off, tired walk, yawn, climb grips, pull-up, peek, duck) and how the manifest consumes them (`locomotion: { mode: 'clip', walk, stride, speedInput, directionInput }`).
