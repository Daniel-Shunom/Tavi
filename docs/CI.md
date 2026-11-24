# Tests and builds

Tests are grouped by program under `tests/`. Local commands and GitHub Actions use the same selection rules in [scopes.ts](../tools/ci/scopes.ts).

| Suite       | Coverage                                                      |
| ----------- | ------------------------------------------------------------- |
| `web`       | Landing page, downloads, dither, mailing-list client          |
| `studio`    | Studio configuration, placement and wardrobe                  |
| `service`   | Companion behavior, platform connections, HTTP and WebSockets |
| `renderer`  | Character manifests, expressions, rigging and runtime motion  |
| `shared`    | Shared expression contracts                                   |
| `desktop`   | Local service binding and desktop packaging unit tests        |
| `email`     | Email delivery and confirmation pages                         |
| `authoring` | Rive authoring tools and generated-fixture integration        |
| `tooling`   | CI selection, event comparisons and test organization         |

Run one group with `npm run test:<scope>`, or several with `npm test -- --scope web --scope studio`. `npm test` and `npm run check` remain full validation commands. Only the `authoring` group rebuilds Rive fixtures.

## CI selection

- Documentation changes check formatting and pinned skills without installing the application or running application tests/builds.
- Landing-only changes run web tests and the frontend build, with no installers.
- Studio-only changes run Studio tests and the frontend build, then native packaging.
- Renderer and shared-contract changes include their consuming programs. Service changes include service and desktop tests.
- Test-only changes run the owning group without producing application bundles or installers.
- The app icon and packaged asset credits remain desktop build inputs, even when a credit file is Markdown.
- Dependencies and common build configuration run every group and relevant build. Unknown or unavailable Git history also falls back to full validation.

PR selection compares the entire branch with its merge base. Main pushes compare the full pushed commit range, including deletions and renamed paths. This avoids losing coverage for earlier commits or large changesets.

Normal PRs and main updates run one Checks workflow. Native packaging reuses its successful checks; it does not repeat them. Version tags and manual installer builds always run full validation before packaging and release publication. Superseded runs are cancelled; PR installer artifacts expire after one day.

The desktop currently bundles the shared frontend. Marketing-only changes deploy to the website without waiting for native packaging, and enter desktop bundles on the next app build. Keep shared application code outside `src/landing/` and marketing assets outside reusable runtime asset directories.

The pre-push hook formats and checks the tree, then runs affected suites using the same rules. New branches compare with `origin/main`; tags and missing comparison history use full validation.
