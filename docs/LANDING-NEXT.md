# Landing page next pass

## Idle life (October 29, 2026)

- The user's bar: moves must make visual sense. Each needs a visible cause, a surface that fits it, a target, believable contact and weight, and clean transitions.
- `src/landing/life.ts` (`TaviLife`, local rules, not AI) keeps three drives:
  - energy: travel, jumps and landings drain it; rest restores it;
  - boredom: rises while nothing happens;
  - interest: the visitor's pointer near her.
  - From these it picks moves, gated by posture and room: none while moving, jumping, acting a scene or hidden behind the button.
- Moves verified on the rig in `build/alive` captures:
  - perched: leg swing (foot nodes), seated wave, `sleepy` (a yawn with an arm stretch) into a doze, startle awake when the visitor stirs, `idle-fidget`;
  - standing: `idle-fidget`, `sassy` for a visitor right beside her, `happy-dance` only on roomy ground (the desk or the floor, never a ledge or the TV top);
  - floor-sit: yawn and doze.
  - Rejected: `peek` (she disappears) and a procedural stretch (lopsided arms).
- The routines wait for a move (`pause`). Tired, the desk swaps zoomies and strolls for sitting, and sprints and runs slow down. The floor picks episodes by mood (`chooseFloorEpisode`): peekaboo behind the CTA for an interested visitor, sit when tired, wander when bored and energetic, otherwise stay by the button.
- The walker exposes `data-life`/`data-swing` for inspection.
- Reactions to the visitor (`src/landing/reactions.ts`, local rules). They play in her face, so they work while she moves; a hop or wave waits until she is free.
  - A pointer arriving near her: a soft smile.
  - A pointer resting on her: a blush, then a giggle.
  - A fast scroll as she sets off: a startle.
  - Landing a drop that skipped sections: proud.
  - Back on the desk after a trip down the page: excited.
  - A visitor returning after 15 s or more away (tab or window): a hop and wave.
  - Hovering the CTA while she is on the floor: she stops (standing up if sitting) and points at it with the arm on its side, excited.
- Leap tempo follows scroll pace (`tempoFor`): 1× for gentle scrolling, up to 3× for a fast flick. It covers the crouch, flight, landing, standing up and leaving the desk. A fast scroll also commits her sooner.
- Face fix: `tavi-refined/motion.ts` drove `ctl.mouth-curve` with the smile sign reversed, so every closed-mouth smile (content, soft-smile, proud, blush) rendered as a frown, and her resting face frowned. It now matches the mascot binding (`mouthCurve = -smile`). The .riv is unchanged; this applies everywhere she renders.

## Motion language (October 29, 2026)

- Tokens on `.tavi-site` (Emil Kowalski's `animate` skill):
  - `--ease-out: cubic-bezier(0.23, 1, 0.32, 1)` for entrances and settles;
  - `--ease-in-out: cubic-bezier(0.77, 0, 0.175, 1)` for travel;
  - `--dur-press` 160ms, `--dur-quick` 200ms and `--dur-base` 280ms for interface feedback;
  - `--dur-reveal` 600ms and `--dur-scene` 900ms for reveals and scene beats.
  - The site's transitions use them. The canvas title card uses the same curve in JS.
  - Tavi's own motion is separate.
- Polish rules: no overshoot or bounce outside Tavi. Hover motion is gated to fine pointers, and presses scale to 0.97. Reveals play once. Reduced motion keeps fades and drops movement.
- Page motion:
  - Section headings wipe up line by line as they enter (`data-reveal`/`data-visible`, `can-reveal` set in `index.html`), and the copy follows with a 60ms stagger. The section art never hides.
  - Tavi's eyes follow her scene's target (chat message, attention dot, call to action, Studio step); the hairline look line was removed at the user's request.
  - A soft shadow bloom plays where she lands.
  - The TV title card enters like a broadcast ident once the signal locks.
  - The chat message she is reading carries a soft light.

## Loading (October 29, 2026)

- The hero no longer runs three.js. `tools/crt-layers` renders the CRT and table once from the same 3D scene (camera, lights, shadows, the CC0 models) into two WebP layers in `public/media/crt/`:
  - the table, with the TV's shadow and the old CSS drop shadow baked in;
  - the TV housing, with the glass cut out.
  - Rerun `node tools/crt-layers/render.mjs <dev origin> build/crt-layers`, then encode, if the models or the camera change.
- The page stacks the layers in 2D: table, Tavi behind the TV, the live 2D screen canvas (`crtScreen.ts`), the housing, then Tavi in front. The screen's tone was matched to the old glass with `filter: contrast(1.17) brightness(0.985)`.
- The stream picture is `tavi-stream-forest.webp` (165 KB, from the 2.8 MB PNG). three.js now loads only with the Avatar Lab (`crtGlass.ts`).
- The opening waits for the TV, then holds the static for its authored 2.8 s and until the picture, Tavi's first frame and the fonts are in, capped at 4 s more. Tavi fades in on her first frame. `index.html` marks the landing page and preloads the TV layers before the app script runs. `main.tsx` preloads the Rive runtime and Tavi's artwork, and loads Studio lazily.
- Production: `npm run build` writes `.br`/`.gz` copies (`tools/precompress.mjs`). The service serves them (`preCompressed`) with immutable caching for `/assets/*` and `no-cache` for everything else.
- Measured on a cold load, throttled:
  - Desktop: TV on screen 3.8 s → 0.9 s; Tavi's artwork 3.8 s → 1.2 s; 7.0 MB → 1.5 MB.
  - Phone (slow 4G, 4× CPU): TV 14.1 s → 5.6 s; Tavi's artwork 19.7 s → 7.4 s.

## Page descent (October 29, 2026)

- The user approved a follow-along flow: Tavi jumps down with the visitor as they scroll, station by station, and reaches the ground at the bottom. `src/landing/descent.ts` (`PageCompanion`) wraps the desk routine.
- Stations: the top edge of the chat illustration (perch), the top edge of the room illustration (perch), then the closing floor line beside "Make Tavi yours". A station becomes the target when its surface rises above 80% of the viewport, holds until it sinks below 92%, and must settle for 0.2 s. The end of the page always targets the floor.
- Down: one leap straight to the station being read, however far (long falls keep the arms up and land harder). Up: reverse hops, one station at a time, back onto the desk, where the routine resumes. Leaving the desk: she stops, comes out from behind the TV if needed, stands, and jumps off the front of the desk or the TV top.
- Click/keyboard greeting works at every station (stand, hop, wave, sit back down). Reaching the bottom earns one hop and wave. Reduced motion places her at the station being read without jumps.
- She stays inside `.stream-stage` (so TV occlusion is unchanged) and travels outside its box; `.site-hero` has `z-index: 2` so she draws in front of the sections below. No rig change.
- Headless Chromium (SwiftShader) shows a rendering band over the first story section on the main checkout too; real Chrome renders it correctly.
- Stop scenes (`SCENES` in `descent.ts`, local timelines, not AI) play once she settles at a station:
  - Chat: the bubbles pop in one at a time and she looks at each (impressed, then a laugh at "Tavi did 😂", then content). Bubbles stay revealed afterwards.
  - Room: she looks at the attention dot, which glows, then along the line, which brightens, then back to the visitor.
  - Floor: she presents "Make Tavi yours" with her screen-left arm (`arm-l`) and an excited face; the button lifts. The bottom-of-page hop and wave come after.
  - The gaze takes a scene `focus` that wins over the pointer. Scrolling away cuts a wave short.
- Phone (390×844) reviewed: no horizontal scroll. The section art has 90px of headroom so she perches clear of the note above it, and the closing footnote is narrowed so she does not stand on it.
- Next: authored edge peeks or landing skids if the procedural ones fall short. The excited expression's first frame reads as a brief frown during the present.

## Current tabletop milestone

- Scroll fix: character and contact shadow are absolute children of `.stream-stage`. Their anchors use offset layout coordinates, not viewport rectangles. IntersectionObserver only pauses offscreen activity; scrolling no longer drives character placement. Completed openings ignore later scroll events.

- Tavi now starts beside the TV on the tabletop, using `tavi-refined`. The user chose to keep her with the TV when scrolling; scroll-follow and its old ledge handoff are deferred.
- `src/landing/tabletop.ts` owns a local route: front walks, rests, a front-edge perch, and a peek behind the CRT. The approved directional walk and front-perch foundations supply the poses. Translation drives walk phase by distance. TV and desk transforms remain fixed.
- Click or keyboard-activate Tavi to greet her. She brakes, faces the visitor and stands before waving, then resumes her route. The target is unavailable when she is behind the TV or offscreen. Reduced motion freezes the automatic route.
- Sitting lowers the body onto the measured tabletop using the authored seat-height offset; feet hang in front of the edge. The existing Three.js depth plane handles TV occlusion. No physics package or generated assets were added.
- The static/glitch and zoom opening remain; Tavi watches from the table rather than using the old screen-exit/jump clips. The fictional stream picture and asset credits remain.

## Earlier direction and deferred work

- Zoom now runs during the initial 2800ms static + 720ms glitch, finishing as the signal locks. Scrolling skips to the final framing and clears intro timers. Reduced motion skips the sequence.
- User wants a rapidly changing montage of real stream/gameplay clips. NOT implemented yet. Source only footage with explicit reuse rights, preserve author/license credits, and use compact local clips. SuperTuxKart benchmark on Wikimedia Commons was researched (CC BY-SA 4.0), but no video was downloaded or integrated. Do not describe random streamer footage as copyright-free.
- The automatic tabletop walk and climb to the TV top are held out of the default hero: the current walk slides and the climb does not communicate contact. The default hero uses automatically triggered in-place Rive expressions and gestures, with no visible trigger. The TV and table stay stationary.
- Next character pass: measure planted-foot positions in the actual Rive rig, align root travel to stance, and create properly blended left/right walks and authored hand/foot contacts for climbing and perching. Review motion at actual size and under different frame rates. The scene geometry and first choreography experiment remain available for development, not as approved production motion.
- When the visitor returns to the top, Tavi should leave the page ledge and resume automatic idle life and movement around the TV and desk, without returning inside the screen. Build that return with authored, contact-checked transitions after the gait is approved; do not teleport her back to the set.
- Replace the page ledge concept with the user's rope idea: a rope hangs beside the corner of the table, and Tavi grips it with one hand to descend as the visitor scrolls. At the bottom she releases it and walks around; on the way back up she catches and pulls the rope, then climbs back onto the table by the TV. Author and verify continuous hand contact, rope response, release, landing, and climbing before shipping; the table and TV remain stationary.
- Current TV picture uses the original curved glass mesh, live Rive canvas compositing, scanlines, vignette and glitch. Site backdrop is pure white; real Poly Haven Wooden Table 02 below TV.
- Desktop and a phone-sized viewport were visually reviewed. The existing scroll-driven page-ledge transition also needs gait and contact refinement; do not treat the earlier preview as production quality.
