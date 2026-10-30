# Working on Tavi

Tavi is a streamer-first expressive companion. Build in reviewable milestones; discuss consequential product decisions before implementing them. The first four days target an end-to-end build, followed by four days of refinement and testing.

## Local skills

Project skills are vendored under `.agents/skills/`. Use these copies instead of requiring a user-global installation. `.agents/skills.lock.json` records upstream repositories, exact commits, and file hashes. Run `python tools/skills.py` to verify; `--restore` restores missing files. Preserve upstream licenses and notices. Newly installed skills are available on the next turn.

- UI creation: `.agents/skills/frontend-design/SKILL.md`.
- Landing pages: `.agents/skills/landing-page-design/SKILL.md` (Elaya Design). Apply alongside Tavi's documented visual direction; the user's established typography, palette, character staging, and motion choices take precedence over skill defaults.
- React implementation: `.agents/skills/react-best-practices/SKILL.md`.
- Component architecture: `.agents/skills/composition-patterns/SKILL.md`.
- UI review: `.agents/skills/web-design-guidelines/SKILL.md`.
- Product interviews: `.agents/skills/grilling/SKILL.md`.
- Domain terminology: `.agents/skills/domain-modeling/SKILL.md`.
- Test-first work: `.agents/skills/tdd/SKILL.md`.
- Bug diagnosis: `.agents/skills/diagnosing-bugs/SKILL.md`.
- Rive (official, discovery only: runtime docs and CLI pointers): `.agents/skills/rive/SKILL.md`. Ask before installing the Rive CLI.
- Character motion quality bar and pipeline (project-local): `.agents/skills/character-motion/SKILL.md`. Use with `.agents/skills/2d-character-rig-animation/SKILL.md`.
- Deterministic procedural animation (timing, seeding, reduced motion): `.agents/skills/procedural-canvas-animation/SKILL.md`.
- UI design, critique and polish (Impeccable 4.8.0): `.agents/skills/impeccable/SKILL.md`. Its launcher downloads a checksum-verified engine binary into `scripts/bin/` or `~/.impeccable` on first run; do not commit that binary.
- Interface motion (Emil Kowalski's `animate`: whether to animate, curves, durations, interruption, reduced motion): `.agents/skills/animate/SKILL.md`. Use it for page and UI transitions; character motion stays with `character-motion`.
- Matt Pocock orchestration skills and setup are installed alongside these. Run setup before invoking workflows that require issue tracker configuration; no tracker is configured yet.

## Ownership and integration

Other agents own `experiments/` and `docs/PERSONALITY.md`. Do not modify them without coordinating with the user. Workstreams (agreed with the user on October 25, 2026):

- Expression system: `src/renderer/`, character manifests and assets, expression/behavior parts of `shared/`, and their tests.
- Windows app: `desktop/` (Tauri shell, service packaging, installer) and release scripts. Read `desktop/README.md` for the desktop handoff.
- Studio, `server/`, root tooling, and remaining tests are shared; keep edits there minimal and coordinated.

The studio and overlay use relative `/ws` and `/api` URLs. Development uses Vite on 127.0.0.1:5173 and the Node service on 127.0.0.1:4318. Production serves built assets and `/overlay` from the service. Keep the renderer independent from Tauri.

## Current milestone

Placeholder layered character, customization, manual gestures, personality-dependent deterministic demo reactions, scene anchors, retraction, quiet mode, saved configuration, and synchronized OBS overlay. Read-only Twitch device authorization and EventSub chat are implemented. Live chat reactions are bounded rules, not AI. Microphone and AI are subsequent milestones. Never present simulations as live AI.

## Verification

Run `npm test`, `npm run build`, and `python tools/skills.py`. Exercise studio and overlay in a real browser when rendering changes. Browser tests do not replace OBS and Tauri checks. Do not commit credentials, local character data, generated builds, or dependency folders.
