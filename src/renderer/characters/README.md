# Characters

Each character is one folder: `<id>/manifest.ts` plus its artwork file. The manifest is the **only**
place renderer details (artboard, clip, state-machine input and node names) may appear;
`tests/no-hardcoding.test.ts` fails if they leak anywhere else. Behaviours, personality, the AI
and the studio work with abstract expression ids from `shared/expressions.ts` and never change
when a character is added.

## Add a model

1. Put the `.riv` file in `src/renderer/characters/<id>/`. Record source, author, license and
   attribution (e.g. under `public/credits/`). Only ship license-compatible artwork.
2. Inventory it: `node tools/rive-inventory.mjs src/renderer/characters/<id>/<file>.riv`.
3. Write `manifest.ts` (validated by `manifestSchema` in `manifest.ts`):
   - `tracks`: handle -> clip name. Everything else refers to handles.
   - `rest`: samples applied every frame to restore a neutral pose; `idleLoop`: ambient loop.
   - `expressions`: library id -> binding (`tracks` with `at` / `play` / `loop` and `mix`,
     optional `transform`, `oscillate`, `presence`, `anticipation`, `recovery`, and
     `variants.subtle` / `variants.strong`). Mark composed poses `composed: true`.
   - `fallbacks`: unsupported id -> supported id, or `null` to drop deliberately. Otherwise
     the library's `similar` list is tried, then the beat is dropped with a recorded reason.
   - `attention`: lean per target (streamer, chat, pointer); `appearance`: slots and options;
     `controls.tuck`; optional `choreographies` (authored entrances/exits);
     `locomotion` (`procedural`, or `clip` with a walk track and speed/direction inputs);
     `motionTracks`, `inputs`, `nodes` exposed to the motion layer.
4. Verify every track really renders: start Vite and run
   `TAVI_TEST_URL=http://127.0.0.1:5173 node tools/rive-clip-sampler.mjs <id>`. It reports
   changed pixels per clip, whether a clip rescales the artboard, and writes contact strips to
   `test-results/clips-<id>/`. Names are not proof: many mascot face/brow/mouth tracks render
   nothing, and "wave testing folio header" permanently rescales the artboard.
5. Register it in `registry.ts`. With more than one character the studio shows a picker.
   `npm test` checks every bound clip exists in the shipped file.

`tests/fixtures/test-character.ts` is a minimal second manifest (different artboard, state
machine inputs, node, authored walk cycle, three expressions) proving the contract.

## Known mascot quirk

The mascot file embeds an empty script, so the Rive runtime logs
`Blank Script 1:1: module must return a value` once on load. Rendering is unaffected; fixing it
needs an edited export of the `.riv`.
