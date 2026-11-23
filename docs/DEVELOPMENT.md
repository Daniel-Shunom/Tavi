# Development

## Checks

```sh
npm run check
npm run build
python tools/skills.py
```

`npm ci` installs the pre-push hook. Run `npm run format` before committing. Use `npm run test:web`, `npm run test:studio` or another [program suite](CI.md) while iterating; `npm test` runs everything. Only authoring tests rebuild Rive fixtures with Python; the Rive CLI is not required.

## Browser checks

With the [dev server](RUNNING.md) running:

```sh
npx playwright install chromium
node tools/browser-check.mjs
```

Screenshots go to ignored `test-results/`. OBS and packaged desktop behavior require separate native checks.

[Repository layout](REPOSITORY-LAYOUT.md) · [Desktop build and release](../desktop/REFERENCE.md) · [Browser preview setup](BROWSER-PREVIEW.md) · [Roadmap](PLAN.md)
