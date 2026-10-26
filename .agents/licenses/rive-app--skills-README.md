# Rive agent skills

Skills that teach coding agents (Claude Code, Cursor, Codex, …) when and
how to use Rive.

## Install

Claude Code:

```
/plugin marketplace add rive-app/skills
/plugin install rive@rive
```

Codex:

```
codex plugin marketplace add rive-app/skills
codex plugin add rive@rive
```

GitHub Copilot CLI:

```
copilot plugin marketplace add rive-app/skills
copilot plugin install rive@rive
```

Gemini CLI:

```
gemini extensions install https://github.com/rive-app/skills
```

Cursor reads the repo's `plugin.json` (the [Agent Plugins](https://agent-plugins.org)
format), so the plugin can be listed in the Cursor Marketplace. Until it is,
use the skills CLI.

Other agents, with the [skills](https://skills.sh) CLI:

```
npx skills add rive-app/skills
```

## Skills

- `rive`: discovery. Tells an agent when Rive fits, then sends it to the
  runtime docs, the CLI's getting-started page or the project's
  `AGENTS.md`, depending on what the user already has. It has no commands
  or flags on purpose: installed copies go stale, so anything technical
  belongs in `rive docs` and the `AGENTS.md` that `rive create` writes.

## Where this is developed

`rive-app/skills` is a mirror. The source lives in `packages/skills` of
Rive's monorepo, and each release replaces this repo's contents with a
fresh build. Pull requests opened here can't be merged, and anything
committed here directly is overwritten by the next release; open an issue
instead.

## Layout

```
.claude-plugin/plugin.json        Claude Code plugin manifest
.claude-plugin/marketplace.json   makes this repo a Claude Code marketplace
plugin.json                       Agent Plugins manifest for Cursor and Codex
.agents/plugins/marketplace.json  makes this repo a Codex marketplace
gemini-extension.json             makes this repo a Gemini CLI extension
skills/<name>/SKILL.md            one folder per skill
scripts/                          build and validation (monorepo only)
```

In the monorepo, only the `.claude-plugin/` files exist. The release build
generates `plugin.json`, `.agents/plugins/marketplace.json` and
`gemini-extension.json` from them, so
edit `.claude-plugin/` and nothing else.

## Releasing

Merging to the monorepo doesn't publish anything, and PRs don't touch
versions: `version` in `plugin.json` here is a placeholder. To release, run
the **Manual - Release skills** workflow on `master`:

1. Pick Patch, Minor or Major. The next version comes from the latest
   `v*` tag on `rive-app/skills`.
2. Leave **dry_run** on first. The run passes the same checks as PRs,
   builds the package with `scripts/build.mjs`, and shows the release
   commit in its summary without pushing.
3. Run it again with **dry_run** off. It replaces `rive-app/skills`'s
   `main` with the build and tags it `v<version>`, in one push.

Installed copies update only when the version changes, so every release
reaches them. If nothing changed since the last release, the workflow says
so and stops.

## Try it locally (monorepo)

Load the plugin for one session:

```
claude --plugin-dir packages/skills
```

Or link the skill into your user skills folder:

```
ln -s "$PWD/packages/skills/skills/rive" ~/.claude/skills/rive
```

Then, in a fresh project, check that prompts like "add an animated mascot
to onboarding" pick the skill and prompts like "fix this SQL query" don't.

The checks are the steps of `.github/workflows/pr_skills.yaml`, one step
each, with the tool versions CI pins. PRs that touch this folder run them,
and every release runs them first. The quickest ones to run locally:

```
node --test packages/skills/scripts/build.test.mjs
claude plugin validate packages/skills --strict
```

To see exactly what a release would publish:

```
node packages/skills/scripts/build.mjs /tmp/skills-build --version 0.0.0-dev
```

Copy any other step's commands from the workflow to run it on that build.
