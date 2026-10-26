# Integrating attachments into the renderer and studio

The asset agent didn't touch the character manifest, the adapter or `shared/protocol.ts`. These
steps wire the attachment layer in. Everything lives under `src/renderer/attachments/` and is
renderer-independent apart from `rive.ts`.

## 1. Character manifest: declare slots

Move the contents of `src/renderer/attachments/rigs/lyla.ts` into
`src/renderer/characters/lyla/manifest.ts` (or import it there):

```ts
import { lylaAttachmentRig, lylaSlots } from '../../attachments/rigs/lyla';
import { lylaRecolor } from '../../attachments/recolor';

export const manifest = {
  // ...existing fields
  attachments: {
    rig: lylaAttachmentRig, // component index -> [runtime name, expected type]
    slots: lylaSlots, // CharacterSlots: slot -> { node, kind, offset, size, follow, rotation }
  },
  recolor: lylaRecolor, // hair / outfit / glasses animations and their base colours
};
```

The slot components are 10 (upper body), 12 (head contents), 661 and 675 (forearm bones). They
don't overlap the motion agent's named nodes (3, 4, 8, 9, 11, 658, 672). Both patches only add
names to unnamed components, so they compose. Apply them one after the other on the same bytes:

```ts
let bytes = await fetchBytes();
bytes = patchRiv(bytes, lylaPatch); // motion agent
bytes = patchForAttachments(bytes, manifest.attachments.rig); // attachments
bytes = recolor(bytes, artboard, manifest.recolor.hair, config.appearance.hairColor);
bytes = recolor(bytes, artboard, manifest.recolor.outfit, config.appearance.outfitColor);
if (wearsEyewear) bytes = hide(bytes, artboard, manifest.recolor.glasses);
const file = await runtime.load(bytes, undefined, false);
```

`src/renderer/attachments/riv/rivBinary.ts` and `fieldTypes.generated.ts` are vendored from
`src/renderer/motion/rive/`, with one addition: `RivObject.at` holds value offsets. When both land,
keep a single copy that includes `at`.

## 2. Adapter: draw the layer

1. Add two canvases to `Avatar.tsx` around the Rive canvas: `back` before it and `front` after
   it, both `position: absolute; inset: 0; pointer-events: none`. Size them like the Rive canvas
   (the same device-pixel ratio) and apply the same opacity during retraction.
2. At setup:
   ```ts
   const { items } = loadAttachments(); // bundle.ts
   const layer = createAttachmentLayer({ slots, items, path: (d) => new Path2D(d) });
   const world = riveTransformSource(board); // once per artboard
   ```
3. Every frame, after `board.advance(dt)`, compute the view matrix with exactly the arguments
   passed to `renderer.align`, then draw:
   ```ts
   const view = viewMatrix(runtime, runtime.Fit.contain, runtime.Alignment.bottomCenter, frame, bounds);
   backCtx.setTransform(1, 0, 0, 1, 0, 0); backCtx.clearRect(...);   // same for front
   layer.draw(backCtx, frontCtx, {
     view, world, dt,
     equipped: config.appearance.attachments,
     tints: config.appearance.attachmentTints,
     palette: { hair: config.appearance.hairColor, outfit: config.appearance.outfitColor },
     still: reducedMotion,
   });
   ```
   If the adapter adds its own rotation around the placement (`placement.rotation`), multiply the
   same rotation into `view` so items stay locked to the character.
4. Call `layer.reset()` after teleports (scene anchor jumps), so springs don't whip.

## 3. Configuration (`shared/protocol.ts`)

Suggested additions to the config schema. They are optional, so saved configs keep loading:

```ts
import { EquippedAttachments, AttachmentTints } from '../src/renderer/attachments/schema';
appearance: z.object({
  attachments: EquippedAttachments.default({}),     // { 'head.top': 'beanie', 'hand.r': 'mug' }
  attachmentTints: AttachmentTints.default({}),     // { beanie: { primary: '#4a7bd8' } }
  hairColor: hex.optional(),                         // custom colour; falls back to riveHair preset
  outfitColor: hex.optional(),
}).default({ attachments: {}, attachmentTints: {} }),
```

On the server, drop equipped IDs that aren't in the bundled catalog, so a stale config can't
break rendering. Because `shared/` shouldn't import from `src/`, the schemas can move to
`shared/attachments.ts` when this lands. They depend only on zod.

## 4. Studio picker

- Add a **Wardrobe** section with one row per slot the character declares (Hat, Hair extra, Face,
  Side, Neck, Left hand, Right hand). Each row is a thumbnail strip from
  `itemsForSlot(items, slot)` plus a **None** option. Selecting an item sends
  `configure { appearance: { attachments } }`.
- Show colour swatches for the equipped item's `tints`. Items with `follow: 'hair'` get a
  "Match hair" toggle that is on by default; turning it off stores an override in
  `attachmentTints`.
- Replace the three hair and outfit preset buttons with presets plus a custom colour picker. Apply
  the picked colour on change, with a debounce of about 150 ms. A recolour rebuilds the Rive file,
  which takes milliseconds, but a rebuild resets clip state, so don't rebuild on every input event.
- When a `head.face` item is equipped, hide the built-in glasses and grey out the glasses colour
  row.
- Thumbnails: render with `tools/assets/screenshot.mjs` at build time, or draw the spec into a
  small canvas with `createAttachmentLayer` and an identity `world`.

## 5. Tests and checks

`tests/attachments.test.ts` covers catalog validation, slot maths, spring stability, layer
routing, recolour/hide on the real `mascot.riv`, and that every Lyla slot resolves in the runtime.
After wiring, check in a real browser, OBS and Tauri that the overlay canvas stays transparent and
that items follow during retraction and peek.
