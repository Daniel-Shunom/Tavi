# Attachment integration

Attachments are already wired into the renderer and Studio. Extend the existing components rather than adding another canvas or drawing layer.

## Character bindings

Lyla uses the `mascot` character directory. Its `lylaAttachmentRig`, `lylaSlots` and `lylaRecolor` exports live in [mascot/attachments.ts](../../src/renderer/characters/mascot/attachments.ts).

[attachmentRigs.ts](../../src/renderer/characters/attachmentRigs.ts) associates those bindings with character IDs. Add a binding there when supporting attachments on another character; keep its component indices, offsets and recolour animations in that character's folder.

## Rendering

[Avatar.tsx](../../src/renderer/Avatar.tsx) already owns the back, character and front canvases. It creates the attachment layer from the selected rig and bundled item catalog, sizes the canvases together and draws the layer through the renderer's decorator callback.

[riveRenderer.ts](../../src/renderer/rive/riveRenderer.ts) patches attachment component names and applies recolours before loading the artwork. The decorator supplies the live view matrix, world transforms and frame delta so attachment drawing stays aligned with the character. Attachment drawing also uses the reduced-motion setting.

## Configuration and Studio

[shared/wardrobe.ts](../../shared/wardrobe.ts) defines equipped items, tint overrides and custom colours. [shared/protocol.ts](../../shared/protocol.ts) stores them under `config.wardrobe` and normalizes them against the catalog.

[LookView.tsx](../../src/studio/LookView.tsx) uses [WardrobePanel.tsx](../../src/WardrobePanel.tsx) to edit that configuration. Reuse this path for new items and slots.

## Verification

Run `npm test`; attachment coverage lives in [attachments.test.ts](../../tests/renderer/attachments.test.ts). Then check alignment, retraction, peeking and transparency in the browser, OBS and the packaged app.

[Attachment authoring reference](ATTACHMENTS.md)
