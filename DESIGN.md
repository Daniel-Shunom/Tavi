---
name: Tavi Studio
description: A warm, character-led control room for a stream companion.
colors:
  night-ink: '#100f17'
  plum-panel: '#17151f'
  raised-surface: '#221f2c'
  quiet-divider: '#2d2939'
  soft-white: '#f4f0f7'
  muted-lavender-grey: '#b6aec2'
  faint-lilac-grey: '#958da2'
  soft-lavender: '#c7b3ea'
  plum-ink: '#1b1424'
  mint-ready: '#8fd3b0'
  coral-warning: '#ffb4a8'
typography:
  heading:
    fontFamily: 'Georgia, Times New Roman, serif'
    fontSize: '34px'
    fontWeight: 400
    lineHeight: 1.1
    letterSpacing: '-0.01em'
  value:
    fontFamily: 'Georgia, Times New Roman, serif'
    fontSize: '20px'
    fontWeight: 400
  title:
    fontFamily: 'DM Sans, system-ui, sans-serif'
    fontSize: '17px'
    fontWeight: 600
  body:
    fontFamily: 'DM Sans, system-ui, sans-serif'
    fontSize: '15px'
    fontWeight: 400
    lineHeight: 1.45
  hint:
    fontFamily: 'DM Sans, system-ui, sans-serif'
    fontSize: '13px'
    fontWeight: 400
  label:
    fontFamily: 'DM Sans, system-ui, sans-serif'
    fontSize: '12px'
    fontWeight: 600
  wordmark:
    fontFamily: 'DM Sans, system-ui, sans-serif'
    fontSize: '22px'
    fontWeight: 700
    letterSpacing: '-0.02em'
rounded:
  key-cap: '6px'
  inner: '10px'
  control: '12px'
  track: '14px'
  tile: '16px'
  card: '20px'
  stage: '24px'
  pill: '999px'
spacing:
  hairline: '4px'
  tight: '8px'
  control: '12px'
  stack: '16px'
  card: '20px'
  section: '24px'
  page: '36px'
components:
  button-primary:
    backgroundColor: '{colors.soft-lavender}'
    textColor: '{colors.plum-ink}'
    typography: '600 15px DM Sans, sans-serif'
    rounded: '{rounded.control}'
    padding: '0 16px'
    height: '44px'
  button-secondary:
    backgroundColor: '{colors.plum-panel}'
    textColor: '{colors.soft-white}'
    typography: '500 15px DM Sans, sans-serif'
    rounded: '{rounded.control}'
    padding: '0 16px'
    height: '44px'
  button-secondary-hover:
    backgroundColor: '{colors.raised-surface}'
  field:
    backgroundColor: '{colors.night-ink}'
    textColor: '{colors.soft-white}'
    typography: '15px DM Sans, sans-serif'
    rounded: '{rounded.control}'
    padding: '10px 14px'
    height: '44px'
  nav-item-current:
    backgroundColor: '{colors.raised-surface}'
    textColor: '{colors.soft-white}'
    typography: '500 15px DM Sans, sans-serif'
    rounded: '{rounded.control}'
    padding: '0 12px'
    height: '44px'
  choice:
    backgroundColor: '{colors.night-ink}'
    textColor: '{colors.soft-white}'
    typography: '500 15px DM Sans, sans-serif'
    rounded: '{rounded.control}'
    padding: '0 14px'
    height: '44px'
  choice-selected:
    backgroundColor: '{colors.raised-surface}'
  segmented-track:
    backgroundColor: '{colors.raised-surface}'
    rounded: '{rounded.track}'
    padding: '4px'
  segmented-option-selected:
    backgroundColor: '{colors.plum-panel}'
    textColor: '{colors.soft-white}'
    rounded: '{rounded.inner}'
    height: '40px'
  switch-on:
    backgroundColor: '{colors.soft-lavender}'
    rounded: '{rounded.pill}'
    width: '52px'
    height: '32px'
  card:
    backgroundColor: '{colors.plum-panel}'
    textColor: '{colors.soft-white}'
    rounded: '{rounded.card}'
    padding: '20px'
  reaction-key:
    backgroundColor: '{colors.plum-panel}'
    textColor: '{colors.soft-white}'
    typography: '500 15px DM Sans, sans-serif'
    rounded: '{rounded.tile}'
    padding: '14px'
    height: '92px'
  pill-link:
    backgroundColor: '{colors.plum-panel}'
    textColor: '{colors.muted-lavender-grey}'
    typography: '500 14px DM Sans, sans-serif'
    rounded: '{rounded.pill}'
    padding: '0 16px'
    height: '40px'
---

# Design System: Tavi Studio

## Overview

**Creative North Star: “A little stage for a little personality”**

Tavi Studio is a calm room built around one character. A left rail holds four places (Live, Look, Personality, Setup); each screen shows one focused panel, and the two screens where her appearance matters keep Tavi in view: Live shows a 16:9 “what viewers see” preview, and Look keeps a sticky portrait stage beside the options. The design voice is playful, warm, and character-led, with a soft accent glow marking what is chosen or happening now.

Keep the interface simple and stylish, with approachable type and familiar controls: Georgia for page titles and the occasional value worth reading aloud, DM Sans for everything else, including the lowercase wordmark. Every surface reads one set of theme tokens, so Studio wears three themes (Moonlight by default, Daydream, Afterhours) chosen in the rail and remembered per browser. Themes belong to Studio only; nothing here shows on stream. Avoid adding visual complexity just to make a screen feel designed.

**Key Characteristics:**

- One place per screen, one focused panel per place; Tavi stays visible where her look is being shaped or performed.
- Quiet tonal surfaces with fine borders; the accent marks action, selection, focus, and the current step.
- Generous, touchable controls: 44px targets, 15px body text, softly rounded 12–20px corners.
- Warmth comes from the character, serif titles, and plain words, not decorative UI chrome.

## Colors

The default Moonlight palette moves from night-ink and plum surfaces to a single restrained lavender accent, with mint and coral reserved for state.

### Primary

- **Soft Lavender**: The one accent. Primary buttons, switches in the on position, the selected choice ring, focus outlines, the current setup step, reaction-key icons, and text selection.
- **Plum Ink**: Text and icons placed on the accent (primary buttons, the setup badge, the current step number).

### Neutral

- **Night Ink**: The app canvas, and the inset background of fields and unselected choices.
- **Plum Panel**: Cards, steps, reaction keys, secondary buttons, the Look stage, and the selected segment.
- **Raised Surface**: Hover and current states (current rail item, selected choice), segmented tracks and tab tracks, answer blocks, and the stage floor.
- **Quiet Divider**: Every 1px border and separator, and the off state of a switch.
- **Soft White**: Primary text.
- **Muted Lavender Grey**: Secondary copy: page ledes, rail items at rest, step descriptions.
- **Faint Lilac Grey**: Hints, notes, field labels, and keyboard hints; still 4.5:1 on every surface.

### State

- **Mint Ready**: Connected service, a completed setup step, the “she is here” dot, and pressed toggle buttons.
- **Coral Warning**: Disconnected service and error banners (as a 10% wash with a 45% border).

### Themes

Each theme redefines the same eleven roles; layouts, radii, and type never change between them.

- **Moonlight** (default, dark): the front-matter values above.
- **Daydream** (light): a pale lilac canvas (#f4f1f6) with white panels (#ffffff) and lilac raised surfaces (#f0ebf4); ink text (#1c1724). The accent becomes a deep plum (#3b2c4a) with white accent ink, so selection reads as a dark mark on a light page. State colors deepen to green (#23704f) and brick (#a8322a) for contrast.
- **Afterhours** (charcoal): blue-black surfaces (#0c0e13, #13161d, #1c2029) with cool grey text, and a warm apricot accent (#efb98d) with dark brown accent ink (#22160c).

**The Lavender Signal Rule.** Reserve the accent (lavender by default; plum in Daydream, apricot in Afterhours) for actions, selection, focus, and the current step; do not use it as general decoration.

**The Token-Only Rule.** New Studio surfaces read the theme variables, never literal hex, so every screen works in all three themes. Fixed colors are limited to things that show the stream itself (the preview backdrop and its overlay labels) and the theme swatches.

## Typography

**Display Font:** Georgia (Times New Roman, serif fallback), used for page titles and a few read-aloud values.
**Body Font:** DM Sans (system-ui, sans-serif fallback), used for controls, copy, headings within panels, and the wordmark.
**Label Font:** DM Sans; no separate mono or data face is established. Keyboard hints use DM Sans 600 at 12px.

**Character:** A single serif title per page brings warmth and individuality; DM Sans keeps every control approachable and easy to scan. Do not introduce a display font into control labels.

### Hierarchy

- **Page title** (Georgia, 400, 34px, 1.1, 28px under 860px): One per screen, sentence case, followed by a one-line lede in muted lavender grey.
- **Value** (Georgia, 400, 20px): A spoken summary of a slider or setting (“Lively”, “Ignores chat”), set beside the control it describes.
- **Wordmark** (DM Sans, 700, 22px, -0.02em): Lowercase “tavi” in the rail, with “Studio” beside it in 13px 500 faint grey; 20px in the dock.
- **Title** (DM Sans, 600, 17px): Card, block, and step headings, and the name field.
- **Body** (DM Sans, 400, 15px, 1.45): Interface copy, buttons, choices, and fields.
- **Hint** (DM Sans, 400, 13px): Notes, helper copy, slider ends, status lines. The smallest size for anything a streamer must read.
- **Label** (DM Sans, 600, 12px): Badges, tags, keyboard caps, and group labels above segmented controls.

**The Warm Clarity Rule.** Prefer sentence case and plain language. Let the type feel conversational; avoid corporate all-caps labels, exaggerated tracking, and overly compressed text.

## Layout

The desktop shell is two columns: a 240px left rail (wordmark, four destinations, then theme swatches and connection status pinned to the bottom) and a scrolling main column padded 28px 36px 48px. The main column opens with the page header (title and lede on the left, an optional pill action on the right) and stacks its content at a 24px rhythm.

Screens use a wrapping two-column pattern: a main column (basis 540px) beside a side column (300–400px) that drops below it when space runs out. Live puts the 16:9 preview and reaction pad in the main column and “now” status in the side column. Look pairs a sticky portrait stage (height clamped between 480px and 760px) with a 400–500px options panel, so Tavi stays in view while options scroll. Personality and Setup are single focused columns of cards and numbered steps.

Below 860px the rail becomes a wrapping top bar: wordmark and theme swatches on the first row, a horizontally scrolling destination row beneath; the theme label and connection text are hidden, main padding tightens to 20px 16px, side columns go full width, and the Look stage stops sticking at a fixed 440px. Below 480px rail icons drop and only labels remain.

The OBS dock (/dock) is Studio’s live controls in one narrow column: wordmark, current status, a two-column reaction pad, and a link back to Studio, at 16px padding and a 14px gap. It reads the theme remembered by Studio.

Spacing runs 4–36px: 4px inside segmented tracks, 8px between related controls, 12–16px inside groups, 20px card padding, 24px between sections.

## Elevation & Depth

Studio is flat and tonal. Depth comes from three surface steps (canvas, panel, raised) separated by 1px quiet borders. Shadows appear only to mark state or to set the stream preview apart.

- **Selected segment** (`0 1px 2px` theme shadow): lifts the chosen option out of its track.
- **Selection ring** (`0 0 0 1px` accent, with an accent border): chosen choices, swatches, and theme buttons.
- **Accent glow** (`0 0 40–48px` of the 16% accent glow, plus the ring): the chosen nature and the current setup step only.
- **Preview lift** (`0 0 0 1px` line plus `0 24px 60px -28px` theme shadow): the 16:9 stream preview, the one object that stands for what viewers see.

Labels laid over the preview use a translucent dark scrim with an 8px backdrop blur so they read over any scene.

**The Earned Glow Rule.** Glow means “this is the one chosen or the one to do next.” Never use it at rest or for decoration.

## Shapes

Corners are soft and graded by size: 6px for key caps and small numbered markers, 10px for options inside a track, 12px for every control (buttons, fields, choices, rail items, theme buttons), 14px for tracks and inline blocks, 16px for reaction keys, 20px for cards, steps, and the preview, 24px for the Look stage. Pills are reserved for badges, tags, the switch, overlay labels, gallery chips, and the header link. Circles are reserved for color swatches, step numbers, and status dots. Borders stay 1px and low contrast except for focus, selection, and the current step.

## Components

- **Rail item:** 20px icon and sentence-case label, 44px tall. Muted at rest; raised surface and soft white on hover and when current. The Setup item carries an accent pill badge (“1/3”) until the three steps are done.
- **Theme picker:** A radiogroup of three 44px square buttons, each showing a diagonal half-and-half swatch of that theme’s surface and accent; the chosen one gets the accent ring.
- **Buttons:** 44px tall, 12px radius. Primary is the accent fill with accent ink and 600 weight, mixing toward the text color on hover. Secondary is a panel fill with a quiet border, raising on hover; when pressed as a toggle it switches to a mint border and text.
- **Fields:** Inset on the canvas color with a quiet border at 44px; the border brightens to faint grey on hover; focus uses the shared 2px accent outline. Range and checkbox controls take the accent color.
- **Switch:** 52×32px pill, quiet divider when off and accent when on, with a white 24px knob that slides 200ms. Set in a row with a 500-weight label and a 13px hint.
- **Segmented control and tabs:** A raised 14px track with 4px padding; options are transparent until chosen, then sit on the panel color with a small lift.
- **Choices and chips:** 44px tiles on the canvas color with quiet borders; selected gains the raised surface and the accent ring. Color swatches are 44px circles with the same ring logic.
- **Cards and steps:** Panel color, 1px quiet border, 20px radius, 20px padding. Steps carry a 36px numbered circle that turns mint when done and accent when current; the current step also takes the accent glow.
- **Reaction pad:** A grid of 92px keys (minimum 118px wide), each with an accent icon, a label, and a small keyboard cap (1–8) in the corner. Keys press down to 97% scale with an accent border; Esc stops. In the dock the keys flatten into 56px rows with the cap at the end.
- **Stream preview:** The 16:9 scene as viewers see it, with a “What viewers see” scrim label, a hover hint, and a dashed placement ring; dragging places her.
- **Status:** Always text plus a dot or icon: mint when connected or here, faint when away, coral when reconnecting. Never rely on color alone.

Motion is short and answers interaction: 160–200ms with a strong ease-out (cubic-bezier(0.23, 1, 0.32, 1)) for switches, disclosures, key presses, and preview hints. Reduced motion removes Studio transitions entirely.

## Do's and Don'ts

- Do keep the character as the most distinctive and visually prominent part of the studio.
- Do keep one focused panel per screen, and keep Tavi visible wherever her look or live behavior is being changed.
- Do use plain, reassuring language for connection, placement, and error states.
- Do keep settings grouped by what the streamer is trying to do, with consistent controls across panels.
- Do keep every interactive target at least 44px and text at 4.5:1 in all three themes.
- Do build new surfaces from the theme variables so Moonlight, Daydream, and Afterhours all work.
- Do preserve keyboard focus visibility, the 1–8 and Esc reaction keys, reduced-motion support, and the narrow-window top bar.
- Do let section headings stand on their own instead of repeating decorative eyebrow labels.
- Do use the accent glow to show a meaningful choice or the next step.
- Don't make the interface resemble a generic corporate dashboard.
- Don't add decorative gradients, badges, or cards where they do not explain hierarchy or state.
- Don't make essential labels or instructions depend on text smaller than 13px.
- Don't let a Studio theme change anything that shows on stream.
- Don't add watermarks or textures to the stage unless they help the character read more clearly.
- Don't use motion only for decoration; transitions should answer an interaction or clarify a state change.
