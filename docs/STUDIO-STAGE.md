# Tavi Studio

Studio is four places, one character, reached from the left rail (a top bar in narrow windows):

- **Live**, the control room while streaming. A 16:9 "what viewers see" preview shows the overlay over a sample scene; click or drag on it to move her home spot. The reaction pad fires the quick reactions (keys **1–8** anywhere in Studio, **Esc** stops), and "Every expression she knows" opens the full set. Beside it: what she is doing, quiet mode, tuck away, where she is (stand, sit, nap, chat, perch, lean), mood and her last reaction.
- **Look**, her appearance. A large portrait stays in view while you change one part at a time: body, hair, face, details and outfit. Surprise me picks a random look, Undo steps back through this visit's looks, and Original look restores the character's own.
- **Personality**: her nature (cozy, playful or shy), energy, how often she starts things, her humour, how much she notices chat, a place to try her out (as you, or as labelled test chat), donation and subscription previews, and what decides her reactions.
- **Setup**: getting her onto a stream, once. Make her yours, add her to OBS (copy the overlay link), let her hear Twitch chat, and optionally add the OBS dock. Then where she hangs out, how she gets around, how she comes and goes, captions, and the stream layout editor. The service cannot see OBS, so you tick that step off yourself; the checklist is remembered in this browser.

Moonlight, Daydream and Afterhours are Studio themes, remembered in this browser. They never change the overlay or the OBS canvas.

## The redesigned Studio (`/studio-next`)

A redesign is being built beside the current Studio in `src/studio-next/` and will replace it once approved. It shares the service connection, saved settings and this browser's theme and setup memory, so both run side by side.

- **The stage** is where a streamer spends their time. The stream preview and the reaction keys never leave; **Live**, **Look** and **Personality** only change the panel beside her. Look fades a close-up of her over the stream view. **Rehearse** (on Live) is one drawer for every test: stream-event previews, saying something as you or as test chat, how she feels, and every expression she knows.
- **The welcome** is a guided first meeting, shown on the very first launch (every later one opens on the stage): say hello (her name and what she is like), bring her to OBS, introduce her to chat. She stands beside each step. Leaving the OBS step for later shows "Finish setup" on the stage.
- **Settings** is a panel over the stage for what is set once: **Connections**, **Stream layout** and **Preferences** (captions, Studio theme, how she decides). The welcome can be run again from here.
- **Jump to anything** (Ctrl K) reaches every place and action. Keys 1–8 and Esc work as before.
- **Themes.** Seven everyday colour schemes (Honey, the default, then Sorbet, Macaron, Lagoon, Arcade, Matcha and Soda) and eight holiday ones (New Year, Lunar New Year, Valentine's Day, St Patrick's Day, Easter, Halloween, Harvest and Christmas), each with a light and a dark tone, chosen in Settings › Preferences along with "Match system". The picker is deliberately just that: one dropdown and a tone. A holiday theme is not chosen from a list: the one in season shows by itself (Christmas through December, Harvest through November, and so on; see `holiday/calendar.ts`), it is the only holiday in the dropdown while its season lasts, and a streamer who swaps to another scheme declines that holiday only, so the next one still arrives. `/studio-next?holiday=halloween` previews a season on any date, and `?holiday=none` previews no season.
- **Holiday themes bring three things** (`src/studio-next/holiday/`). _Her room_: the stage is dressed as a room for the holiday, with a wall and floor, things at the back and hanging from the ceiling, and props in front of her for depth. It is lit while she is here, dim in quiet mode, dark on a break, and joins in while she reacts. It is Studio-only and labelled so; "Decorate her room" on the Live panel switches it off. _A ninth reaction key_ (key 9) that cues an existing quick reaction. _A countdown card_. Room pictures are Microsoft's Fluent Emoji (MIT; `tools/holiday-art.mjs` copies the ones in use, with credits in `holiday/art/CREDITS.md`); the small marks are Tabler Icons (MIT). Schemes live in `src/studio-next/themes.ts`, and `tests/studio-themes.test.ts` measures every text and icon pairing for contrast, so a new scheme (a holiday one, say) is added there and checked by the same test. The new Studio remembers its theme separately from the current Studio and the OBS dock.
- **Wording.** She is a companion being met, not a product being configured: she joins, listens and decides. Prefer "Cue a reaction", "Give her a break" and "Say hello" to "Make her react", "Tuck her away" and "Make her yours".

Controls are Base UI (`@base-ui/react`) styled with Studio's theme tokens; Motion (`motion`) animates only what CSS cannot (panels and her close-up leaving). Motion timings are named at the top of `src/studio-next/studio-next.css`.

## The OBS dock

`/dock` is Studio's live controls in a narrow panel: the reaction pad (same keys), stop, quiet mode, tuck away and mood. In OBS, open **Docks › Custom Browser Docks**, name it Tavi and paste `http://127.0.0.1:4318/dock` (Setup shows the exact link).

## Checks

With the service running, `TAVI_TEST_URL=http://127.0.0.1:4318 node tools/browser-check.mjs` walks the four screens (name, nature, a typed line, tuck away, perch) and checks the transparent overlay and the mobile width. `tools/expression-browser-check.mjs`, `tools/attention-browser-check.mjs` and `tools/variants/creator-check.mjs` exercise reactions, attention and the character creator through the new screens. `tools/studio-next-check.mjs` walks the redesigned Studio (the first-launch welcome, the three modes, Settings, Rehearse, Jump to anything and a narrow window). Screenshots are saved in ignored `test-results/`.
