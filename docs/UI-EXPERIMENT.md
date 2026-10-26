# Companion stage experiment

The avatar is the primary interaction surface. A full-width stage stays visible above a separately scrolling tool deck. The layout allocates physical space to each region; tools cannot cover the avatar. A More tools control reallocates space without turning tools into an overlay.

The portrait is a presentation mode of the existing renderer. It centers and enlarges the character in the studio without changing the stream placement. OBS retains the original transparent canvas and coordinate system.

Visual direction: a quiet dusk-lit character stage with a circular horizon, soft floor shadow, and three user-selected lighting presets. Palette: night #11131c, stage #171a2c, deck #151720, lilac #d2bdf4, text #e9e8f1, muted #a0a3b8. Existing bundled Manrope handles display type; DM Sans handles controls.

Controls remain real: click-to-wave, gestures, quiet/retract, saved customization, personality, placement, Twitch, simulated input, and OBS setup. Stage lighting is local presentation only. Tools remain mounted while navigating to retain Twitch UI state.

Guidance consulted: project-local frontend-design, React performance, and composition skills; current Anthropic frontend-design and Vercel Web Interface Guidelines upstream documentation. No unverified third-party skill bundle was installed.

## Handoff

Preview: http://127.0.0.1:5173/. Run `npm run dev` if stopped. Stage remains visible; tools scroll below it and can be expanded. Lighting presets, click-to-wave, gestures, customization, personality, placement, Twitch, playground, and OBS setup are functional. OBS remains at `/overlay`. Artwork is still a placeholder.

Browser checks passed for desktop, laptop, mobile, and short-screen layouts; screenshots are in `test-results/companion-stage-desktop.png` and `test-results/companion-stage-mobile.png`. Root Vitest tests are scoped to `tests/**/*.test.ts`; the separately owned Rive experiment uses its own test runner. Other agents own desktop/Tauri and experiments. Microphone and AI remain future work.
