# Character variants

Tavi's character can look like a wide range of people while keeping one rig, so every expression,
gait, body state, choreography and attachment works unchanged. The research and the design guide
behind every choice here are in [`VARIANTS-RESEARCH.md`](VARIANTS-RESEARCH.md). Read part 7 of it
before adding anything.

## What a variant is

A variant (`shared/variants.ts`, a Zod schema) has independent axes. All of them are available with
all others:

| Axis          | Values                                                                                                                                                                                |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Skin          | Tone 1–10 (hand-tuned ramp) or the original pink, × undertone warm / neutral / cool / olive                                                                                           |
| Face          | round, soft-square, oval, heart, full                                                                                                                                                 |
| Build         | slim, average, broad, full                                                                                                                                                            |
| Age           | young, adult, elder (elder adds one smile line per side; grey hair is a hair colour)                                                                                                  |
| Eyes          | dark brown, brown, hazel, green, blue, grey, teal (original)                                                                                                                          |
| Hair          | 14 styles (below) + any colour (natural and dyed swatches, or custom)                                                                                                                 |
| Features      | freckles, blush, built-in glasses, vitiligo (face / hands / both), hearing aids (L/R/both, any colour), facial hair (stubble, moustache, beard), prosthetic forearm (L/R, any colour) |
| Head covering | none, hijab, dastar (turban), headwrap, any colour                                                                                                                                    |

`shared/variantPresets.ts` holds 15 complete starting points. They are labelled by features only,
for example "Tone 8 · Locs · full build". The saved configuration has a `variant` field. Files
without one load as the original mascot look, and legacy v1 `skin`/`hairstyle` values migrate onto
the ramp and the hairstyles (`shared/protocol.ts`).

## How it renders (and why motion stays shared)

```text
variant ──> applyVariant(mascot-v2.riv)  in-memory edits, same byte layout of names/objects
        │     skin, shade, highlight, nose/mouth line, blush, iris  (fills found by NAME)
        │     hide built-in hair / glasses (colours and their appearance animation keys)
        │     build: shirt/hip scale, shoulder spacing, limb stroke thickness
        │     face: offsets on the 4 face-outline vertices, ears follow width
        └─> variant overlay layer        hair, coverings, features as shape sets on the
              attachment canvases (behind / in front), following named rig parts:
              head, face features move, hair squash, hair left/right swing bones, forearms
```

- **Rig contract.** Every component, name, type, animation, joystick and control track is
  identical to the authored file. `tests/variants.test.ts` checks this for every preset and for
  every value of every axis. It also checks that no variant edits a property that any clip or
  control track keys, so all acting reads the same values.
- **Body states.** Builds never change legs, feet, hip height or soles, only limb thickness, so
  `soleOffset`, seat heights and contacts stay valid. A test enforces this. A height axis would
  change them; see the authoring specs below.
- **Hair physics.** The side locks of locs, braids, the bob and long hair are bound to the remix's
  own `hair left swing` / `hair right swing` bones, so the `tavi/hairSwing` control moves them.
  Back masses follow `hair squash`. Springs add secondary motion (puffs, buns and the ponytail
  bounce).
- **Characters.** `src/renderer/characters/variantRigs.ts` maps character ids to variant rigs.
  Only `mascot-v2` has one. With another character, the creator offers to switch.

## Files

| Path                                                                           | What                                                               |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------ |
| `shared/variants.ts`, `shared/variantPresets.ts`                               | Schema, skin ramp, presets, legacy mapping                         |
| `src/renderer/characters/variants/rig.ts`                                      | Variant rig type, name selectors, resolver                         |
| `.../variants/rigs/mascotV2.ts`                                                | Lyla v2: which fills are skin/hair/eyes, build edits, anchors      |
| `.../variants/apply.ts`, `rivEdit.ts`                                          | In-memory file edits                                               |
| `.../variants/palettes.ts`, `colorScience.ts`                                  | Undertones, hair and eye palettes, OKLCH and contrast              |
| `.../variants/overlay/`                                                        | Geometry helpers, hairstyles, features/coverings, compose, drawer  |
| `src/CharacterCreator.tsx`                                                     | Studio creator section (between Make it yours and Wardrobe)        |
| `tools/variants/sheet.html`                                                    | Contact sheet (presets, hairstyles, ramp × undertones)             |
| `tools/variants/shoot.mjs`, `creator-check.mjs`                                | Screenshots of the sheet; browser check of the creator and overlay |
| `tools/variants/probe.html`, `measure.html`, `tune-ramp.ts`, `probe-colors.ts` | Authoring aids                                                     |

## Add a preset

1. Add a `preset(...)` call to `shared/variantPresets.ts`. Describe it by features. Never use a
   person, ethnicity or race word: the presets test checks for those.
2. Run `npm test`, then look at its row on the contact sheet.

## Add a hairstyle

1. Add its id to `hairStyles` in `shared/variants.ts`, in research priority order, and give it a
   label in `hairStyleLabels`.
2. Write a builder in `overlay/hairstyles.ts` that returns a `ShapeSet`. Coordinates are head space:
   the origin is the `head` node, the face outline is centred at (1, −92) with radii 95 × 93, brows
   are at y −125, eyes at −94, the nose at −61, the mouth at −40 and the ears at x ±105, y −80. Use
   the helpers (`cap`, `hairline`, `cloud`, `strand`, `tube`, `marks`, `spiral`).
   - Back volume goes in `behind: true` layers that follow `hairBack`.
   - Locks that should swing with the hair follow `hairLeft` / `hairRight`, plus a spring.
   - Use the palette slots `hair`, `hairShade`, `hairDeep` (texture marks), `hairHighlight` and
     `scalp` (parts between sections).
3. Follow the drawing spec in `VARIANTS-RESEARCH.md` section 3:
   - Textured hair grows up and out, with edge texture.
   - Braids and cornrows show scalp parts and roots.
   - Never draw a smooth helmet or a perfect circle.
4. Run the sheet:
   1. Start Vite.
   2. Open `/tools/variants/sheet.html?only=hair`, or run
      `TAVI_TEST_URL=http://127.0.0.1:5173 node tools/variants/shoot.mjs hair`.
   3. Look at the large, 220 px, walk and celebrate frames over light and dark backgrounds.
5. Run `npm test`. It checks that the paths are valid, anchors and springs exist, and every paint
   resolves.

## Add a character to the variant system

Write a `VariantRig` (copy `rigs/mascotV2.ts`):

1. Name selectors for its skin, shade, highlight, blush, nose, mouth and iris fills
   (`npx tsx tools/variants/probe-colors.ts <file.riv>` lists every fill with its owner names).
2. Its hair shapes and colour animations, and its glasses animations.
3. Build edits on properties no clip keys (the test tells you).
4. Its face outline shape and its overlay anchors.

Measure head-space geometry with `/tools/variants/measure.html`, then register the rig in
`characters/variantRigs.ts`.

## Design checklist (every new variant, hairstyle or feature)

Copied from the design guide. Tick each one on the contact sheet.

- [ ] The rig-contract test passes. Same nodes, controls, tracks and `soleOffset`, and nothing
      keyed is edited.
- [ ] It performs expressions and a walk on the sheet with no clipping, popping or detached parts.
- [ ] It reads at 220 px over light, dark, grey and saturated backgrounds. Its silhouette differs
      from the others.
- [ ] Skin comes from the ramp. Shades keep chroma and rotate toward red, never grey.
- [ ] Eyes, nose, mouth shape and mouth hue are unchanged by tone. No exaggerated features, no race
      label.
- [ ] Textured hair has volume, growth direction, edge texture and scalp parts.
- [ ] No trait is the subject of a reaction or a joke.
- [ ] Head coverings work with every tone, face and build.
- [ ] Attribution to alisketch's CC BY 4.0 base art is kept (`public/credits/rive-avatar.md`).
- [ ] Community review status is recorded below.

## Review status

The hairstyles, the dark end of the ramp, the head coverings and the accessibility features have
**not** been reviewed by people from the affected communities. The guide recommends paid review
before a public release:

- Black and textured-hair artists for the hair and the ramp.
- Hijab, dastar and headwrap wearers for the coverings.
- Disabled people for the hearing aids, the prosthetic and vitiligo.

Do not describe these as endorsed until that happens.

## What the rig cannot express yet (authoring specs)

These need art in the remix (`art/mascot-remix/`, authored through
`tools/mascot-remix/author.mjs`'s `authorTavi(source, spec)`), not runtime edits:

1. **Height (short / tall).**
   - Leg length changes the hips relative to the planted soles. The clips key the foot IK targets
     (`tavi/footL/R` x/y), so a setup edit cannot lengthen the legs.
   - Spec: per-height leg bone lengths (`Left LEG BONE`, `KNEE BONE`, right chain) plus a
     `tavi/body` rest y offset, built as separate `.riv` files from the same source.
   - Each file needs its own `soleOffset` and body-state seat values (`characters/mascot/states.ts`).
2. **Wheelchair users.**
   - This needs a seated base pose, a chair drawn behind the legs (a modern light rigid chair with
     no push handles), and gaits that roll instead of step. The motion library has no rolling
     locomotion or seated idle.
   - Spec: a `tavi/clip/seated` rest, a `chair` group under `tavi/body` with a wheel node that
     locomotion can rotate, and a `roll` gait in `motion/systems/gaits/` (motion agent).
3. **Hair inside the rig.**
   - Overlays draw behind the whole character or in front of it, never between the head and the
     arms. When the arms rise past the face, front locks cover them.
   - For exact layering, author each style as shape groups skinned to the `hair left/right swing`
     bones and parented under `hair squash`, toggled by `tavi/look/hair/<style>` animations. The
     overlay geometry in `overlay/hairstyles.ts` is the reference (head space as above).
4. **Face shapes beyond the outline.** Cheek fullness and jaw width as shape keys (a `tavi/face`
   joystick with blend states) instead of vertex offsets, so the ears and hair line can follow.
5. **Vitiligo on all skin.** Patches are drawn on the face and forearms. Patches on the legs and
   neck need skin-masked shapes in the file.
6. **Prosthetic hand poses.** The hand is recoloured to the prosthetic colour. A distinct
   prosthetic hand needs its own hand-pose shapes under the forearm bone.
7. **Mouth.** The mouth line is recoloured by name (`mouth`, optional). If the new mouth shape
   library should follow skin tone, keep a fill or stroke named `mouth` there, or add its names to
   the variant rig.

## Decisions for the user

- **Default look.** New and existing configs default to the original mascot (pink skin, curls,
  glasses). The research advises a deliberate default that is not the lightest tone. Options are to
  keep the original, pick a mid-tone preset, or randomise on first run.
- **Default character.** Variants need Lyla v2 (`mascot-v2`). The registry default is still
  `mascot`. Should v2 become the default?
- **Preset names.** Presets use feature descriptions, not names. Friendly names would need care to
  avoid ethnic connotations.
- **Which features ship.** All of the features above are implemented. Before release, decide
  whether to wait for community review or ship with the review note.
