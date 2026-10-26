---
name: Tavi Studio
description: A warm, character-led control room for a stream companion.
colors:
  night-ink: '#11131c'
  deep-indigo-stage: '#171a2c'
  tool-deck: '#151720'
  raised-surface: '#191b26'
  field-surface: '#1d1d2a'
  soft-white: '#e9e8f1'
  muted-lavender-grey: '#a0a3b8'
  quiet-divider: '#30313f'
  soft-lavender: '#c5b3f5'
  lavender-action: '#d2bdf4'
typography:
  body:
    fontFamily: 'DM Sans, sans-serif'
    fontSize: '15px'
    fontWeight: 400
  heading:
    fontFamily: 'Georgia, Times New Roman, serif'
    fontSize: '26px'
    fontWeight: 400
    letterSpacing: '-0.25px'
  label:
    fontFamily: 'DM Sans, sans-serif'
    fontSize: '11px'
    fontWeight: 400
  wordmark:
    fontFamily: 'Manrope, sans-serif'
    fontSize: '29px'
    fontWeight: 800
    letterSpacing: '-1.6px'
rounded:
  control: '8px'
  button: '9px'
  section: '23px'
spacing:
  tight: '8px'
  control: '12px'
  section: '28px'
components:
  button-primary:
    backgroundColor: '{colors.lavender-action}'
    textColor: '#2c203e'
    typography: '600 12px DM Sans, sans-serif'
    rounded: '{rounded.button}'
    padding: '11px 16px'
  field:
    backgroundColor: '{colors.field-surface}'
    textColor: '#e3d7ec'
    typography: '12px DM Sans, sans-serif'
    rounded: '{rounded.control}'
    padding: '10px 12px'
  tool-navigation-active:
    backgroundColor: '#c2a5e914'
    textColor: '#e0c9f7'
    typography: '12px DM Sans, sans-serif'
    rounded: '8px'
    padding: '11px 12px'
---

# Design System: Tavi Studio

## Overview

**Creative North Star: “A little stage for a little personality”**

Tavi Studio pairs a calm, dark workspace with a lively character stage. The companion is the emotional center of the interface; controls should make it easy to shape and direct that personality without competing with it. The design voice is playful, warm, and character-led, with a soft lavender glow as its recurring accent.

Keep the interface simple and stylish, with approachable typography and familiar controls. The current implementation uses Georgia for expressive stage and settings headings, DM Sans for interface text, and bold Manrope for the wordmark. Preserve those roles when extending the current system, favoring a human, expressive feel over a corporate geometric-font look. Avoid adding visual complexity just to make a screen feel designed.

**Key Characteristics:**

- A character stage sits above a compact, organized tool deck.
- Dark indigo surfaces create a quiet backdrop; lavender signals action and selection.
- Warmth comes from the character, soft lighting, and tactile details—not decorative UI chrome.

## Colors

The palette moves from night-ink and deep indigo to a restrained lavender accent; character-specific stage lighting can introduce soft green or rose tones.

### Primary

- **Soft Lavender**: The main interaction accent for selected tools, focus, and small expressive highlights.
- **Lavender Action**: Primary actions use this brighter lavender with a dark plum text color for clear contrast.

### Neutral

- **Night Ink**: The app canvas and top-level chrome.
- **Deep Indigo Stage**: The character stage base; lighting variants can shift this surface.
- **Tool Deck**: The settings deck, visually separated from the stage by a fine border and ambient shadow.
- **Raised Surface**: Reusable panels and popovers within the dark interface.
- **Field Surface**: Inputs and selects, inset against the surrounding panel.
- **Soft White**: Primary text on dark surfaces.
- **Muted Lavender Grey**: Secondary labels and supporting copy.
- **Quiet Divider**: Low-emphasis separators between sections and controls.

**The Lavender Signal Rule.** Reserve lavender for actions, selection, focus, and a few character-led accents; do not use it as general decoration.

## Typography

**Display Font:** Georgia (Times New Roman, serif fallback), used for stage and settings headings.
**Body Font:** DM Sans (sans-serif fallback), used for controls, supporting text, and most interface copy.
**Label Font:** DM Sans; no separate mono or data face is established. The lowercase wordmark keeps its bold Manrope styling.

**Character:** Expressive serif headings bring a little warmth and individuality; DM Sans keeps controls approachable and easy to scan. The wordmark retains its bold Manrope treatment. Avoid a corporate geometric-font look and do not introduce a display font into dense control labels.

### Hierarchy

- **Stage headline** (Georgia, 400, responsive 27–45px): A short, welcoming phrase in the character preview.
- **Section heading** (Georgia, 400, 26px): Names the current group of settings.
- **Wordmark** (Manrope, 800, 29px): The compact lowercase Tavi signature in the top bar.
- **Body** (DM Sans, 400, 14px base): Clear, compact interface copy.
- **Control text** (DM Sans, 400–600, 11–12px): Field values, buttons, and navigation. Keep future controls comfortably readable; do not shrink labels further to gain density.
- **Microcopy** (DM Sans, 9–10px in the current UI): Used sparingly for secondary stage metadata. Avoid using this size for essential instructions or actions.

**The Warm Clarity Rule.** Prefer sentence case and plain language. Let the type feel conversational; avoid corporate all-caps labels, exaggerated tracking, and overly compressed text.

## Layout

The desktop studio has a 74px top bar and a two-part workspace: a generous character stage above a resizable tool deck. The deck opens with a compact heading, then uses a left navigation rail beside one vertically scrolling settings surface. The standard deck occupies roughly one third of the available height; its expanded state grows to about half. Keep the avatar visible while users work whenever the window size permits.

The layout adapts below 1100px and 700px, shifting the tool navigation and controls for narrower windows. Preserve clear section boundaries and scrolling ownership at every size. Use the existing 8–28px spacing rhythm as a guide, with more space around section starts than between related controls.

## Elevation & Depth

Use layered, atmospheric depth. The stage gets its dimension from restrained radial light, one quiet orbit, and the character itself. The tool deck is distinguished with a subtle top border and soft shadow; controls sit on slightly raised or inset tonal surfaces. Keep shadows quiet and functional, and avoid adding floating cards around every setting.

## Shapes

Controls use softly rounded corners, generally 7–10px. Tool navigation uses a modest 8px radius; the tool deck has a broader curved top edge (23px) to distinguish it from the stage. Pills and circular swatches are reserved for status, compact choices, and color selection. Keep borders low contrast except for focus, selection, or interaction feedback.

## Components

- **Primary button:** Soft lavender fill, dark plum text, compact padding, and a clear hover lift/glow. Use for the main action in a local context.
- **Text field and select:** Dark inset surface with a quiet violet border; brighten the border on hover and use the shared visible focus ring for keyboard navigation.
- **Tool navigation item:** Icon and sentence-case label on a transparent surface. Use a muted lavender surface and brighter text for the current section.
- **Stage gesture dock:** A compact translucent floating control group that stays visually subordinate to the character. Use it for direct preview actions, not general navigation.
- **Status indicator:** Pair a short text label with a small colored dot; do not rely on color alone to communicate connection state.

## Do's and Don'ts

- Do keep the character as the most distinctive and visually prominent part of the studio.
- Do use plain, reassuring language for connection, placement, and error states.
- Do keep settings grouped by what the streamer is trying to do, with consistent controls across panels.
- Do preserve keyboard focus visibility, reduced-motion support, and responsive behavior.
- Do let section headings stand on their own instead of repeating decorative eyebrow labels.
- Do use the soft lavender glow to show a meaningful action or selected state.
- Don't make the interface resemble a generic corporate dashboard.
- Don't add decorative gradients, badges, or cards where they do not explain hierarchy or state.
- Don't make essential labels or instructions depend on tiny microcopy.
- Don't add a watermark, texture, or extra orbit unless it helps the character read more clearly.
- Don't use motion only for decoration; transitions should answer an interaction or clarify a state change.
