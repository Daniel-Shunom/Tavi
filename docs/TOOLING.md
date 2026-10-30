# Reproduce the tooling

Commit `.agents/` together with the application and `package-lock.json`. A normal clone already includes all 11 project skills and supporting files; no global skill install is needed. Verify with `python tools/skills.py`. Restore missing files with `python tools/skills.py --restore` (network required). Modified files are reported and never overwritten automatically. Updates are deliberate changes to both vendored files and the lockfile. Upstream notices are retained under `.agents/licenses/` and within skill folders. Poteto skills are pending identification of the intended source repository.

Application dependencies use `npm ci` from the lockfile. Agent skills may reference live external guidance or optional CLIs, so pinned skill files reproduce the instructions, not external services or model behavior.
