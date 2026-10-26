# Tavi Rive character experiment

Independent character-design lab. Does not modify the main studio, protocol, renderer, or Tauri app.

## Run

```powershell
cd experiments/rive-avatar
npm install
npm run dev
```

Open http://127.0.0.1:5186/ . The default is the full-body chibi-style reference by alisketch. Try Wave, Thinking, Celebrate, and the hair/outfit/glasses color choices. Original creator opens the artist's interactive customization UI. Other references are selectable for comparison. Raw artboards, animation names, state-machine inputs and data-binding fields are available for inspection. Local .riv uploads remain in the browser.

The runtime, WASM, and reference files are served locally. `npm run build` creates a standalone static build. The lab is not yet wired into OBS, AI, Twitch, or desktop; the stage's Peek/Tuck actions are host transforms, not authored character poses.

## Performance sandbox

Open http://127.0.0.1:5186/performance.html . This is the next character experiment: idle -> listening -> skeptical -> idle, six manual reactions, cheeky/gentle/spicy caption variants, expression strength, preserved palette choices, a delayed tuck-away, and optional locally scheduled initiative. Escape cancels a reaction. Reactions replace each other rather than queuing. Reduced motion removes host breathing/lean/nod and holds the idle pose still. Returning from a background tab does not replay missed time.

The controller uses low-level Rive animation-instance sampling and blending. A full authored neutral pose is reapplied before each reaction, with palette tracks applied last. Pose sampling is kept separate from the pure timing director. The original `.riv` is unchanged. This is not an AI, microphone, or Twitch integration.

**Important discovery:** animation names are not proof of working controls. Sampling the exported file showed no rendered change from `face x`, `face y`, `brow left`, `brow right`, individual upper/lower eyelid tracks, `mouth X`, `mouth Y`, and `mouth smile frown`. The performances therefore blend verified full-character clips (including thoughtful, hands-on-hips, blink variants, wave, and celebration), plus small host transforms. Listening and skeptical are composed interpretations, not newly authored native expressions. The original claim that independently named face tracks could immediately drive those channels was too optimistic.

To add true eye direction, one raised eyebrow, lip shapes, or new interchangeable art, edit the source rig in Rive and export a revision with explicit data-bound controls. Do not treat the local JS animation director as an authored `.riv` state machine.

Run `npm test` for the five timing/transition/cancellation behavior checks. Both pages are included in `npm run build`. Browser checks covered all six performances, scene phases and idle recovery, tuck/restore, palette selection, captions, 120 repeated action replacements, narrow viewport, and native cleanup with no page errors. Contact sheets and rendered evidence live in ignored `artifacts/`.

## Findings

- alisketch's Mascot / Avatar Customization is the closest tested visual match: full-body, chibi-like proportions, original color selector UI, a standalone `lyla animation` artboard, and verified wave/thoughtful/celebration/blink clips. Independently named brow/face/mouth tracks were found inactive in runtime sampling. Hair, clothing, and glasses have three authored color variants each. It does not provide an extensive interchangeable wardrobe or hair-shape library.
- nasmith's Rive Avatar is a pixel-art head, despite its broad marketplace description. It exposes face-part choices and color/head/mouth parameters through data binding. Useful technically, not the agreed initial aesthetic.
- hemantp-B9R83's Interactive Character Customizer UI is a cartoon human head with accessory/color toggles and wink-related behavior.
- JcToon's Avatar Creator provides a stylized non-human builder with numeric body/eye/hair controls.

All are third-party reference characters. The native `.riv` files are unmodified. Attribution and sources are in `public/assets/ATTRIBUTION.md`; source artboards and hashes are in `public/assets/catalog.json` (the original asset also has `asset-source.json`). Preserve their CC BY attribution when reusing them. New Tavi character designs and missing gestures still require authoring work in Rive.

## Verification

Production build passed. All four assets loaded in a real Chromium browser; runtime inspection reports and screenshots are generated under ignored `artifacts/`. Software WebGL and pausing before screenshots were needed for reliable headless capture. Standalone chibi transparency, changed hair/outfit/glasses colors, and visible wave/celebration poses were inspected. Browser interaction checks passed for color selection, wave playback, retract/restore, creator switching, reset, and narrow-screen layout, with no page errors. Tauri/OBS rendering and long-running memory behavior have not been tested for this experiment.

## Next design decision

Evaluate the default character's proportions and acting as a reference. The user selected this licensed rig as the current foundation. Decide which missing facial channels to author first in a Tavi-specific revision. Do not replace the main renderer until that decision and the runtime adapter are reviewed.
