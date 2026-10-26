# Tavi

A customizable, expressive chibi companion that hangs out in a streamer's OBS canvas. Built for the Twitch x Codex hackathon.

## Run the proof of concept

Requirements: Node.js 22.12+ (use the same Node major across machines), npm, and Python 3.10+ for skill verification.

```powershell
npm ci
python tools/skills.py
npm run dev
```

Open http://127.0.0.1:5173. Customize the character, try gestures, and compare cozy, playful, and shy personalities in the reaction playground. Character changes are saved by the Node service to `.data/character.json` and synchronized with all connected previews.

In OBS, add a Browser Source with URL `http://127.0.0.1:5173/overlay`, width 1280 and height 720. Keep the local service running. The overlay contains only the character with a transparent background. The studio's webcam/chat panels are placement guides, not OBS source detection. Peeking currently happens at the canvas edge.

To run the production build:

```powershell
npm run build
npm start
```

Studio: http://127.0.0.1:4318. OBS overlay: http://127.0.0.1:4318/overlay.

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
