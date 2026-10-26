# Tavi attachments and appearance assets

Tavi's character is a Rive file with its own rig. Clothing or hair from another `.riv` is skinned
to that file's bones and can't be moved onto Tavi without the Rive editor. Wearables therefore
come in two kinds:

1. **Attachments.** These are data-defined vector items (hats, headphones, eyewear, hair
   overlays, scarves, hand props) pinned to named **slots**. Every frame, each slot reads a rig
   component's world transform from the live artboard (`TransformComponent.worldTransform()`), so
   items move with idle motion, gestures, walking and entrances. Dangly parts swing on damped
   angular springs. Items are drawn on two Canvas2D layers stacked behind and in front of the Rive
   canvas, using the same alignment matrix as `Renderer.align`.
2. **Recolours.** Lyla's hair, outfit and glasses colours are baked into appearance animations
   (`hair Pink`, `clothing green`, `glasses blue`). `recolor()` rewrites those animations' colour
   keys in memory around any picked colour and keeps the artist's shadows and highlights. `hide()`
   makes them transparent, which is how eyewear replaces the built-in glasses. Colours have a fixed
   width, so the byte layout never changes.

## What an overlay can and can't do

- It can follow position, rotation and squash of a node or bone. It can sit in front of or behind
  the whole character, take tints from a picker or from the character palette (`follow: "hair"`),
  and swing on springs from stage motion and tilt.
- It can't deform with the hair or cloth meshes, be occluded by parts of the character (for
  example, sit between the hair and the face), or change the silhouette of the built-in hair. Hair
  overlays (fringe, ponytail, buns) layer on top of or behind the existing hair. They don't replace
  it.

## Layout

| Path                                 | What                                                                                                                        |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| `assets/items/<id>.json`             | One attachment spec per file (validated by `AttachmentSpec`).                                                               |
| `assets/catalog.json`                | Registry: provenance, licence, redistribution and modification rights, status (`ready`/`converted`/`candidate`/`rejected`). |
| `src/renderer/attachments/schema.ts` | Zod schemas: spec, catalog, slot bindings, equipped config.                                                                 |
| `.../catalog.ts`, `bundle.ts`        | Pure validation (`parseCatalog`) and the Vite-bundled loader (`loadAttachments`).                                           |
| `.../layer.ts`                       | Slot maths, tint resolution, springs, Canvas2D drawing (`createAttachmentLayer`).                                           |
| `.../rive.ts`                        | Runtime glue: name slot components, read world transforms, compute the view matrix.                                         |
| `.../recolor.ts`, `riv/`             | In-memory `.riv` recolour and hide (vendored scanner from the motion agent).                                                |
| `.../rigs/lyla.ts`                   | Lyla's slot bindings (component indices, offsets, reference sizes).                                                         |
| `tools/assets/`                      | Preview page, screenshot capture, authoring CLI, rig probe.                                                                 |

## Spec format (short)

```jsonc
{
  "id": "beanie",
  "name": "Pom beanie",
  "category": "hat",
  "slot": "head.top",
  "viewBox": [0, 0, 100, 60], // item coordinates
  "anchor": [50, 22], // point pinned to the slot origin
  "size": 0.9, // width as a multiple of the slot's reference size
  "offset": [0, 0],
  "rotation": 0, // optional nudges in slot units / degrees
  "tints": { "primary": { "label": "Knit", "default": "#f2a65a" } }, // optional "follow": "hair"
  "springs": {
    "pom": {
      "pivot": [50, 12],
      "stiffness": 90,
      "damping": 7,
      "inertia": 0.003,
      "maxAngle": 18,
      "hang": 0.3,
    },
  },
  "layers": [
    { "d": "M8 42 C8 18 ...Z", "fill": { "tint": "primary" } },
    { "d": "...", "fill": { "tint": "primary", "shade": -0.22 } }, // shade: -1 ink .. +1 white
    { "d": "...", "fill": { "tint": "secondary" }, "spring": "pom" },
    { "d": "...", "fill": "#ffffff", "behind": true }, // drawn behind the character
  ],
}
```

Slots and their reference sizes on Lyla (artboard units): `head.top` and `head.hair` (origin at
the top of the hair, 300 = hair width), `head.face` (eye line, 180 = face width), `head.back`,
`head.side` (upper right of the hair), `neck` (under the chin, 100), `torso`, `hand.l` and
`hand.r` (end of the forearm bones, 100, mostly upright).

Style guide, matching alisketch's mascot: flat fills with no outlines, one darker shade layer
(`shade` −0.2 to −0.35) on the lower right, and one soft highlight (`shade` +0.3 to +0.5) on the
upper left. Use rounded shapes and saturated but soft colours. Use the warm ink shading, never pure
black.

## Adding an asset (spec → SVG → validate → preview)

1. **Spec.** Write `assets/items/<id>.json` by hand, or convert a vetted SVG with
   `npx tsx tools/assets/assets.ts import path/to/icon.svg <id> <slot>`. That imports `<path>`
   elements only, and turns each distinct colour into a tint. Pick a slot, then set the anchor to
   the point that touches the character (a hat's crown contact, a prop's grip).
2. **Catalog.** Add an entry to `assets/catalog.json` with origin, author, licence, source URL and
   `redistribution`/`modification`. Loading refuses items without both rights. For discovered art,
   add the credit to `public/credits/attachments.md`.
3. **SVG check.** Run `npx tsx tools/assets/assets.ts svg <id>`. This writes
   `test-results/assets/svg/<id>.svg` with default tints and a green anchor dot.
4. **Validate.** Run `npx tsx tools/assets/assets.ts validate`. `npm test` validates the bundled
   catalog too.
5. **Preview.** Run `npx vite --host 127.0.0.1 --port 5297` and open
   `http://127.0.0.1:5297/tools/assets/preview.html`. Equip the item, try every clip, and try
   **Stage → Walk across / Entrance loop** to exercise the springs. Add `&debug` to see the slot
   frames.
6. **Screenshots.** Run `node tools/assets/screenshot.mjs [--only <id>] [--outfits "slot:id,slot:id"]`.
   It writes PNGs to the git-ignored `test-results/assets/`. Look at them and adjust `anchor`,
   `size`, `offset` and `rotation` until the item reads correctly in every pose.

A prompt that works for a future agent: _"Add a `<thing>` attachment for slot `<slot>` following
docs/assets/README.md; match the mascot style, tint slots `<names>`, verify with screenshots in
three clips."_

Finding slot nodes on a new character: `npx tsx tools/assets/probe.ts <file.riv> "<artboard>"`
names every transform component in memory and prints its world position and bone lengths. Choose
nodes whose motion matches the body part, then add a `rigs/<character>.ts` with `expectTypes` and
slot offsets.

## True rigged clothing and hair (needs the Rive editor)

Overlays can't bend with the rig. For wearables that deform (sleeves, skirts, long hair that
swings with `hair swing`), the artist authors them in the character's `.riv`:

- **Artboard:** the character artboard (for example, `lyla animation`). Put each wearable in a
  group named `wear/<slot>/<itemId>`, such as `wear/head.top/beanie` or `wear/torso/hoodie`, and
  skin its meshes to the existing bones.
- **Visibility:** one solo or opacity property per item, keyed by an animation named
  `wear <slot> <itemId>` (opacity 1 for that item, 0 for the others in the slot), or a view-model
  enum `wear_<slot>`. Tavi already drives appearance through such animations, so no new runtime
  path is needed.
- **Colours:** give each colourable fill a palette animation named `tint <itemId> <tint>` whose
  keys use one base colour. `recolor()` can then retarget it to any picked colour.
- **Anchors for overlays:** export named, empty nodes `slot/<slotId>` at each slot origin (for
  example, `slot/head.top` on the head, `slot/hand.r` at the palm). That removes the
  index-based patching in `rigs/<character>.ts`.
- **Hair variants:** add `hair <style>` animations that toggle mesh groups (`hair/<style>/*`) and
  share the existing hair bones, so the `hair swing` and `hairswoop` joysticks keep working.
- Export names: the Rive exporter strips component names unless they are marked for export. Mark
  `wear/*` and `slot/*` groups for runtime export.
