# Rive CLI evaluation

Status: installed and tested on October 25, 2026 (Windows 11, `rive 1.8.0`). The user approved
"check, then install".

## What it is

`rive` is Rive's official command-line tool for coding agents. It compiles a directory of plain
text sources (RML, an XML projection of Rive's object model, plus Luau scripts, WGSL shaders,
images and fonts) into a runtime `.riv` and an editor-openable `.rev`
([getting started](https://rive.app/docs/cli/getting-started)). The vendored `rive` skill
(`.agents/skills/rive/SKILL.md`) points to it.

| Question                 | Finding                                                                                                                                                                                                                                                                                                                                                                                                      |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Official distribution    | Yes: `releases.rive.app/cli`. The installer was read in full before it ran. It fetches a manifest, checks the archive's SHA-256, extracts only `rive.exe`, `docs/` and `samples/`, rejects unsafe paths and symlinks, and installs into `%USERPROFILE%\.rive` with that folder on the user PATH.                                                                                                             |
| Windows                  | Supported (`windows-x64`). Installed with `RIVE_VERSION=1.8.0` pinned.                                                                                                                                                                                                                                                                                                                                       |
| Cost and login           | Creating, previewing, verifying and building locally needs no account and works offline. `rive login` is needed only for `--publish` (signed builds), `.rev` export, `push`/`pull` and `--from-remote-file`. Publishing a clean build needs a workspace on the Cadet plan or higher.                                                                                                                         |
| Licence and terms        | The docs state no licence for the CLI binary. It is a proprietary Rive tool covered by Rive's terms of service, which I have not reviewed in detail. The runtimes we ship (`@rive-app/webgl2`) are MIT. Usage analytics are unset; `rive analytics off` disables them.                                                                                                                                       |
| What it can author       | Everything in the runtime format: artboards, shapes and paths (vertices animatable), bones, skins and weights, image meshes, all constraints (IK, distance, transform, follow path), joysticks, linear animations, state machines with layers and blend states, view models and data binding, listeners and Luau scripts. Its `docs/rigging.md` and `docs/easing.md` cover joysticks and skinning in detail. |
| Editing an existing .riv | **No.** It opens only CLI projects. Projects can be created from an editor `.rev` (`rive create <dir> --from-rev=x.rev`) or from a file in the user's Rive account (`--from-remote-file`, needs login). Our `mascot.riv` is a runtime export: `rive create --from-rev` on a copy fails with "not a .rev this tool can read". There is no `.riv` decompiler.                                                  |

## Proof: a face authored as text and loaded through our adapter

`tools/rive-cli-proof/gen-face.mjs` generates `scene.rml` for a tiny original chibi face: head,
cheeks, eyes, brows and a three-vertex mouth path. It has joystick-convention range timelines
(`brows`, `mouth-curve`, `blink`: first frame is the -1 pose, middle is rest, last is +1), a
one-shot `oops` (startled brow lift, blink, eyes dart aside, wide flat "uh-oh" mouth, squash)
and a state machine. Build it like this:

```sh
rive create faceproof          # scaffold (once)
node tools/rive-cli-proof/gen-face.mjs faceproof
rive faceproof --verify        # compile check
rive inspect faceproof --summary
rive faceproof --once          # unsigned .riv (fine: no scripts) -> faceproof/build/faceproof.riv
```

The 1.7 KB result is `src/renderer/characters/cli-face/cli-face.riv` with the manifest
`src/renderer/characters/cli-face/manifest.ts` (not registered as a selectable character).
`tools/rive-cli-proof/` loads it through `manifestSchema` and `createCharacterRenderer`, the
same path the studio uses. `node tools/rive-cli-proof/shoot.mjs` screenshots rest, raised and
furrowed brows, smile, frown, a half blink and two `oops` frames to `test-results/rive-cli-proof/`.
Every channel rendered as authored.

What went wrong on the first try, and is worth knowing:

- **Draw order is reversed from document order**: the first child draws on top. A head declared
  first hid the whole face.
- **Vertex keys use the vertex property keys** (`x` 24, `y` 25), not the node keys (13, 14). Keying
  13/14 on a vertex builds and verifies cleanly and does nothing. `rive inspect --json` shows
  `propertyName` per key, which exposes this.

## What real work would take

- **Modifying the mascot (walk-in, climb, visemes, new face shapes).** It needs the editor
  source. Either the user remixes alisketch's community file into their Rive account (CC BY 4.0
  allows derivatives with attribution) and runs `! rive login`, then
  `rive create mascot-src --from-remote-file`, or someone exports a `.rev` from the editor. After
  that, everything is text: add mouth shapes as `Solo` children (one viseme per child, switched by
  a bound number), add brow-inner/outer timelines and joysticks, bind joystick `x`/`y` to view
  model numbers, and add a face layer to the state machine. Skinned meshes are the painful part
  to write by hand (packed weights, bind matrices), so new bones on existing art should be
  bound in the editor and refined as text.
- **New original characters.** Feasible fully from text for simple geometric (Duolingo-style)
  characters: shapes, bones, rotation-based limbs, joysticks and state machines. The proof face
  took minutes. Illustrated quality (gradients, organic paths, weighted meshes) still needs an
  artist.
- **Walk cycles and climbing** are keyed bone rotations plus IK targets (two-bone IK for knees,
  one-bone IK as look-at). They are authorable as text, but appeal needs iteration in the
  previewer (`rive <dir>`) or the editor.
- **Runtime fit.** Joysticks re-apply their timelines every frame from their own `x`/`y`, so our
  renderer cannot scrub a joystick's timeline directly (the motion layer's in-memory patch works
  around this). For files we author, the clean contract is a view model with one number per
  face channel bound to the joystick axes. That needs the runtime's data-binding API. Until then,
  authoring range timelines without joysticks (as the proof does) works with the current adapter.

## Recommendation

Use the CLI for new rig layers and original test characters, and for the artist spec's file
conventions (`docs/character/RIG-SPEC.md`). It cannot fix the shipped mascot without its editor
source. To unblock that, the user would need to remix the community file and run `! rive login`;
I have not signed in.
