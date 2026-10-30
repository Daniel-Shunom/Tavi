# Development

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

## Pull request reviews

CodeRabbit is configured in `.coderabbit.yaml` to review ready pull requests automatically. Enable the CodeRabbit GitHub App for this repository in the CodeRabbit dashboard. Its standard PR integration does not require a GitHub Actions workflow or API secret. Review guidance covers accessibility, reduced motion, graphics cleanup, and Studio/OBS compatibility.

The test command recreates local Rive authoring fixtures from committed sources before running Vitest. This uses Python and does not install or invoke the Rive CLI. Generated fixture directories stay untracked.
