# Handoff: state of `master` (October 26, 2026)

Work below was built by parallel agents in git worktrees and merged into local `master` after each passed `npm test`, `npm run typecheck`, `npm run lint`, `prettier --check .`, `npm run build` and `python tools/skills.py` (327 tests at handoff). Nothing has been pushed.

## What exists

- **Expression system** (`docs/EXPRESSION-SYSTEM.md`): model-agnostic library in `shared/expressions.ts`, timed cue contract (`shared/cue.ts`), character manifests (`src/renderer/characters/`), AI providers in `server/ai/` (OpenAI-compatible, Anthropic, rules fallback labelled "Rules (not AI)"), scene-aware attention (`shared/attention.ts`).
- **Characters**: `mascot` (v1, shipped CC BY export) and `mascot-v2` (default; built from the user's Rive remix by `tools/mascot-remix/author.mjs` → `slim.mjs` → `rive art/mascot-remix --once`). v2 adds elbows, hand poses, pupils, a 21-shape Duolingo-style mouth library, brow tilt, authored walk/trudge cycles, body-state poses and a three-quarter turnaround. Rig contract: `docs/character/RIG-SPEC.md` §1b.
- **Motion** (`docs/motion/`): grounding and gravity, idle life, head-led turning (`turnStyle`), gait + mood library with the "How it moves" picker, story-beat entrances/exits.
- **Body states** (`docs/states/`): sit, ledge-sit, doze, nap, peek at chat, perch, lean; scene editor; rule-based triggers.
- **Posing pipeline** (`docs/motion/POSING-AND-STAGING.md`, `POSE-PIPELINE.md`, `tools/pose-lab/`): pose-as-data, rubric checks; climb re-staged and sitting postures done.
- **Variants** (`docs/character/VARIANTS*.md`): character creator, skin ramp, 14 hairstyles, head coverings, features.
- **Wardrobe/attachments** (`docs/assets/`), **Windows installer** (`desktop/README.md`).

## Not finished

- Posing polish still to do: knee-dust with v2 hands, nap/perch/lean/peek against the rubric, 2–4 new states.
- Installer not rebuilt or retested since the first Windows build; OBS, live Twitch and a real AI provider are untested with current `master`.
- Variant hairstyle overlays not checked during the three-quarter turn.
- Flaky under memory pressure: `tests/attachments.test.ts`, `tests/motion-layer.test.ts` and the server tests (timeouts; pass on rerun).

## Before a public hackathon submission

- License audit: `art/mascot-remix/` contains CLI-pulled extras (font, reference images, UI SVGs) with unverified licenses. Mascot art is CC BY 4.0 (alisketch); keep credits in `public/credits/`.
- Hackathon requires building with OpenAI Codex; much of this work was done with Claude Code (commits carry `Co-Authored-By: Claude`). Check the rules and disclose.
- Demo video and an updated README are required.

## Open product decisions

Default variant look; community review before release; overlapping expressions (smirk/smug, grin/excited, and similar); quiet-mode and trigger thresholds; AI default models and budgets. Details are in each agent's docs.
