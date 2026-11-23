# Development

## Checks

```sh
npm run check
npm run build
python tools/skills.py
```

`npm ci` installs the pre-push hook. Run `npm run format` before committing. Tests rebuild local Rive fixtures with Python; they do not require the Rive CLI.

## Browser checks

With the [dev server](RUNNING.md) running:

```sh
npx playwright install chromium
node tools/browser-check.mjs
```

Screenshots go to ignored `test-results/`. OBS and packaged desktop behavior require separate native checks.

[Repository layout](REPOSITORY-LAYOUT.md) · [Desktop build and release](../desktop/REFERENCE.md) · [Browser preview setup](BROWSER-PREVIEW.md) · [Roadmap](PLAN.md)
