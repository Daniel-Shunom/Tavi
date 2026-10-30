# Landing page surface brief

## Scope and visitor mode

Public website landing page at `/`, in Persuade mode. Studio stays available at `/studio`; the OBS overlay remains at `/overlay`.

## Audience, job, action, proof, and constraints

For streamers considering a more expressive on-stream companion. Show how Tavi feels in a stream, then invite the visitor to watch the product demo or open Studio. Use the actual in-repo Rive character renderer. The stream scene is a fictional preview, explicitly labeled as such. Do not claim live AI behavior.

## Direction contract

**THESIS:** Tavi starts trapped inside a stream that will not start, gets it working, then climbs through the screen and follows the visitor. The character's journey is the cinematic device.

**OWN-WORLD:** A pure white (#ffffff) site backdrop frames a real, front-facing CRT on a low wooden desk. Warm charcoal type and restrained lavender accents keep the page readable and character-led. Atmospheric indigo and violet belong inside the stream picture. Use sourced 3D assets, with the fictional stream and Rive character rendered on the TV's actual curved glass. Keep the tabletop nearly edge-on and the character's page ledge subtle.

**STORY:** On page load, a centered computer screen crackles with static. Tavi, inside it, panics and bangs on the screen. The stream starts; Tavi calms. The camera pulls back to reveal the stream title “Tavi” and the chat line “Your stream companion.” As the visitor scrolls, Tavi braces against the bezel, says “Wait for me,” climbs out, and settles on a site ledge while reacting to the story. At the bottom, Tavi jumps down to the page floor and interacts near the Studio invitation. Scrolling back up makes Tavi jump back to the ledge; Tavi never re-enters the screen.

**FIRST VIEWPORT:** Center the computer as the opening shot. Start close on static and Tavi's frantic performance. Pull back during the static and glitch, finishing as the signal locks and revealing Tavi's stream title and the chat slogan. Keep the stream clearly marked as a fictional preview.

**HERO STAGE:** The intended performance lets Tavi explore the desk, glance playfully at the set, pass behind its actual geometry, and sit on top. Behaviors trigger automatically without visible controls. The TV and table remain stationary; depth comes from character motion and occlusion. Scroll can interrupt the performance. The tabletop walk and climb remain experimental until their foot and hand contacts are convincing. The default hero uses in-place idle gestures in the meantime.

**FORM:** Scroll is the director of a two-way, phase-based performance. The Rive character rig owns every body pose and action (panic, impacts, brace, climb, ledge sit, jump down, jump back up); the page only places the Rive stage and controls scroll pacing. Scrolling quickly must not skip Tavi's screen-hold and climb-out beat. The reverse journey returns to the ledge, never to the screen. Expressions and gaze are intentional to the scene and visitor. Keep it usable on mobile and with reduced motion.

**FINISH:** unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Production notes

Use authored Rive animation for Tavi's actions and face; do not approximate a climb, brace, sit, or jump by translating or rotating a static portrait in CSS. A short scroll-paced hold is part of the story, but must remain reversible and feel like a character beat rather than a broken page. Keep the current fictional stream environment until real footage is supplied.
