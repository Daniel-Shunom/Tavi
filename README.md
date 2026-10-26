# Tavi

A customizable, expressive chibi companion that hangs out in a streamer's OBS canvas. Built for the Twitch x Codex hackathon.

## Project description

Tavi is a customizable animated companion for livestreamers. It lives in an OBS Browser Source and can wave, emote, move between scene positions, tuck away, and react to chat with small, personality-aware gestures. Streamers can adjust Tavi's appearance, wardrobe, personality, and placement in the studio. Twitch chat reactions use bounded rules and cooldowns; the current build does not make AI-generated decisions or replies. The reaction playground is clearly labeled as a demo, so simulated events are not presented as live stream activity.

## How we used Codex

We used Codex as a collaborative coding partner to explore the existing React, TypeScript, Rive, and Node service architecture, then implement and refine features across the studio, shared behavior contracts, character renderer, and OBS overlay. Codex helped trace behavior from the UI through the validated commands and renderer, and supported iterative UI and motion work. We kept the product boundaries explicit in the code and documentation: Twitch reactions are rule-based, demo inputs are labeled, and AI integration is not described as live functionality.

## Run the proof of concept

Requirements: Node.js 22.12+ (use the same Node major across machines), npm, and Python 3.10+ for skill verification.

```powershell
npm ci
python tools/skills.py
npm run dev
```

Open http://127.0.0.1:5173 for the cinematic landing page, or visit http://127.0.0.1:5173/studio to customize the character, try gestures, and compare cozy, playful, and shy personalities in the reaction playground. Character changes are saved by the Node service to `.data/character.json` and synchronized with all connected previews.

## Landing page vision

The landing page introduces Tavi through a small, authored character story rather than a static product mockup. The opening image is a computer screen with stream-like static. Tavi is inside it, panicking and trying to start the stream. Once it starts, she settles; the camera pulls back to reveal “Tavi” as the stream title and “Your stream companion” in the chat. The stream scene should feel active, with Tavi doing small idle activities inside a fictional stream environment.

As the visitor scrolls, Tavi notices them, climbs out of the screen, and follows along the page. She can hold onto the screen edge if the visitor scrolls ahead, with a short “Wait for me” bubble, then naturally reach an artificial ledge and sit beside the content. Her pose and expression can react to the section passing by. At the bottom, she jumps down and explores around the final content in a way that suggests the page components. Scrolling back up brings her back to the ledge; she does not climb back into the screen.

Motion should be authored for Tavi's rig in Rive, with readable full-body weight, anticipation, contact, balance, and follow-through. The scroll choreography should remain legible at different viewport sizes and scroll speeds, and should coordinate character gaze, body orientation, expressions, and the page elements she is reacting to. The current implementation is an early, reviewable choreography pass; it establishes the stream opening, climb/brace, ledge, and scroll-driven transitions for continued art and motion refinement.

In OBS, add a Browser Source with URL `http://127.0.0.1:5173/overlay`, width 1280 and height 720. Keep the local service running. The overlay contains only the character with a transparent background. The studio's webcam/chat panels are placement guides, not OBS source detection. Peeking currently happens at the canvas edge.

To run the production build:

```powershell
npm run build
npm start
```

Landing page: http://127.0.0.1:4318. Studio: http://127.0.0.1:4318/studio. OBS overlay: http://127.0.0.1:4318/overlay.

## What works now

- Shared layered chibi rig with skin, hair, outfit, hairstyle, and accessory options.
- Blink/breathe animation and wave, smile, surprise, point, and peek gestures.
- Scene anchors and position adjustments, tuck away, and quiet mode.
- Local saved configuration and server-authoritative WebSocket synchronization.
- Deterministic reaction playground demonstrating personality differences.

Microphone capture, transcription, and AI decisions are not connected yet. Live Twitch chat is available through the Connect Twitch panel. The UI labels all simulated inputs. Quiet mode suppresses simulated reactions while retaining explicit manual controls. Nonzero chat engagement levels are not yet a probabilistic policy; zero disables demo chat reactions.

## Repository layout

- `src/`: React studio and PixiJS/Tween.js renderer.
- `shared/`: validated configuration, commands, and demo behavior boundary.
- `server/`: Fastify/WebSocket service and local configuration persistence.
- `tests/`: behavior and real WebSocket integration tests.
- `desktop/`: Tauri shell maintained by the other agent; see its README.
- `.agents/skills/`: vendored project-local agent skills.
- `.agents/skills.lock.json`: pinned sources and SHA-256 hashes.
- `tools/skills.py`: dependency-free skill verification and restoration.

## Reproduce the tooling

Commit `.agents/` together with the application and `package-lock.json`. A normal clone already includes all 11 project skills and supporting files; no global skill install is needed. Verify with `python tools/skills.py`. Restore missing files with `python tools/skills.py --restore` (network required). Modified files are reported and never overwritten automatically. Updates are deliberate changes to both vendored files and the lockfile. Upstream notices are retained under `.agents/licenses/` and within skill folders. Poteto skills are pending identification of the intended source repository.

Application dependencies use `npm ci` from the lockfile. Agent skills may reference live external guidance or optional CLIs, so pinned skill files reproduce the instructions, not external services or model behavior.

## Validate

```powershell
npm test
npm run build
python tools/skills.py
```

See `docs/PLAN.md` for the four-day build and four-day refinement targets. OBS rendering and the packaged Tauri app still require manual verification.

## Formatting and typing

`npm ci` installs the local Git pre-push hook through the prepare script. The hook runs Prettier automatically, blocks the push if tracked formatting changes need committing, and runs format checks, type-aware ESLint, strict TypeScript checks, tests, and skill verification. Run `npm run format` before committing to avoid that extra step. CI repeats checks and builds on pushes and pull requests.

TypeScript enables strict mode, checked indexed access, exact optional properties, unused-code checks, and other strictness flags. ESLint rejects explicit `any` and unsafe operations on untyped values. Inbound WebSocket data is validated with Zod. Third-party declarations are skipped by the compiler; application code remains checked. Vendored skill files and the other agent's `desktop/` directory are excluded from root formatting and linting. Desktop formatting should be coordinated with its owner.

Browser smoke check (with the dev server running): `npx playwright install chromium`, then `node tools/browser-check.mjs`. The check saves a screenshot under ignored `test-results/`. Fonts are bundled locally so the studio does not need external font requests.

## Connect Twitch

The registered public Client ID is built into `shared/twitch.ts`; it is not a secret. Start Tavi and click **Connect Twitch**. Open the displayed Twitch authorization link in your browser and approve read-chat access. The registered Twitch app must use the **Public** client type. This device-code flow does not use a callback URL or client secret. If Tauri does not open the link yet, use **Copy authorization link** and paste it into your system browser. The desktop owner can integrate that link with Tauri's external-browser opener.

After approval, Tavi listens to the authorized account's own channel using Twurple EventSub WebSockets. Recent chat appears in the studio. Messages addressing the companion by name or saying `Tavi` can produce a small personality-dependent gesture, with a 30-90 second cooldown based on chat engagement. Quiet mode, retraction, and zero chat engagement suppress these reactions. These are rule-based live reactions, not AI-generated responses. No chat messages are sent by Tavi.

Access and refresh tokens remain in Node service memory, never browser storage or overlay state. Restarting the service requires reconnecting. During a session, Tavi validates tokens, refreshes before expiry, and handles revocation. Disconnect clears local state and attempts Twitch token revocation. Chat history is bounded and held only in memory; Twitch deletion and clear events remove messages from the panel.

Live credentials are not needed for automated tests: Twitch HTTP and EventSub boundaries use controlled fixtures. Real end-to-end account authorization and chat delivery require approval in the streamer's browser.

Twitch UI smoke check: with the dev server running, execute `node tools/twitch-browser-check.mjs`. It uses browser route fixtures and does not authorize an account or send chat.

## Companion stage UI experiment

The studio keeps a large centered portrait visible above a separately scrolling tool deck. Use the lighting controls for Moonlight, Daydream, and Afterhours; click the character to wave. **More tools** reallocates space without covering the avatar. Appearance, personality, Twitch, playground, and stream setup remain mounted and accessible in the tool deck. Studio lighting and portrait positioning do not change the OBS canvas.

With the dev server running, `node tools/stage-browser-check.mjs` checks that scrolling and expanding the tools never covers the avatar at desktop, laptop, mobile, and short-screen sizes, including keyboard tab navigation. Screenshots are saved in ignored `test-results/`.
