# Tavi Studio

Studio is four places, one character, reached from the left rail (a top bar in narrow windows):

- **Live**, the control room while streaming. A 16:9 "what viewers see" preview shows the overlay over a sample scene; click or drag on it to move her home spot. The reaction pad fires the quick reactions (keys **1–8** anywhere in Studio, **Esc** stops), and "Every expression she knows" opens the full set. Beside it: what she is doing, quiet mode, tuck away, where she is (stand, sit, nap, chat, perch, lean), mood and her last reaction.
- **Look**, her appearance. A large portrait stays in view while you change one part at a time: body, hair, face, details and outfit. Surprise me picks a random look, Undo steps back through this visit's looks, and Original look restores the character's own.
- **Personality**: her nature (cozy, playful or shy), energy, how often she starts things, her humour, how much she notices chat, a place to try her out (as you, or as labelled test chat), donation and subscription previews, and what decides her reactions.
- **Setup**: getting her onto a stream, once. Make her yours, add her to OBS (copy the overlay link), let her hear Twitch chat, and optionally add the OBS dock. Then where she hangs out, how she gets around, how she comes and goes, captions, and the stream layout editor. The service cannot see OBS, so you tick that step off yourself; the checklist is remembered in this browser.

Moonlight, Daydream and Afterhours are Studio themes, remembered in this browser. They never change the overlay or the OBS canvas.

## The OBS dock

`/dock` is Studio's live controls in a narrow panel: the reaction pad (same keys), stop, quiet mode, tuck away and mood. In OBS, open **Docks › Custom Browser Docks**, name it Tavi and paste `http://127.0.0.1:4318/dock` (Setup shows the exact link).

## Checks

With the service running, `TAVI_TEST_URL=http://127.0.0.1:4318 node tools/browser-check.mjs` walks the four screens (name, nature, a typed line, tuck away, perch) and checks the transparent overlay and the mobile width. `tools/expression-browser-check.mjs`, `tools/attention-browser-check.mjs` and `tools/variants/creator-check.mjs` exercise reactions, attention and the character creator through the new screens. Screenshots are saved in ignored `test-results/`.
