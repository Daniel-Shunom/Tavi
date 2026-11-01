# Download page

## Scope

`/download` is a separate page, not the landing page scrolled to its closing section. It inherits the white, warm charcoal, lavender, and Georgia/DM Sans visual language.

## Composition

A compact two-column scene pairs the download controls with the real Tavi renderer. On phones the headline leads into the character scene, then the controls. Tavi keeps the landing's bounded idle behavior, follows pointer attention, and waves when selected. Reduced motion suppresses automatic acting.

The Twitch × Codex lockup is painted into the same ordered dither as the scene light, with distinct ink and clear space. It must remain readable at phone sizes. The landing keeps its original “Make a little you.” headline, paragraph, and “Make Tavi yours” action.

## Verification

`node tools/download-page-check.mjs` checks the built app on the local judging runner. It covers a drawn character, greeting, Windows release lookup states, preview navigation, responsive layout, and the original landing copy. Screenshots are written to ignored `test-results/download-page/`.
