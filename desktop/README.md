# Tavi Studio desktop

Tavi Studio is the desktop app for the Tavi streamer companion. It contains everything it needs: you do not need Node.js, Rust, or a terminal to use it. The app runs a small local service on your PC, opens the studio window, and serves the OBS overlay at `http://127.0.0.1:4318/overlay`.

Requirements: Windows 10 or 11 (x64). Microsoft Edge WebView2 is used to draw the window. It ships with Windows 11 and current Windows 10; if it is missing, the installer downloads it.

## Cross-platform build pipeline

[Desktop installers on GitHub Actions](../.github/workflows/desktop-installers.yml) uses native standard GitHub runners:

| Platform            | Runner           | Installer              |
| ------------------- | ---------------- | ---------------------- |
| Windows x64         | `windows-latest` | NSIS `.exe`            |
| Linux x64           | `ubuntu-22.04`   | `.deb` and `.AppImage` |
| macOS Intel         | `macos-15-intel` | `.dmg`                 |
| macOS Apple Silicon | `macos-15`       | `.dmg`                 |

macOS builds require macOS 13.5 or newer because the bundled Node 24 runtime requires it. Linux builds target an Ubuntu 22.04/WebKitGTK 4.1 baseline. Each app contains its own matching Node runtime; users do not install Node or Rust. Linux/macOS are new build targets and still need native UI/OBS acceptance checks.

Pull requests that touch the app and pushes to main build all four targets. **Actions ? Desktop installers ? Run workflow** starts a manual build after the workflow is merged. Each successful job uploads installers and SHA-256 files as `tavi-studio-<platform>` artifacts, retained for seven days. Download the artifact ZIP from its workflow run and extract it before installing.

To publish a downloadable release, update `desktop/package.json` and `desktop/src-tauri/Cargo.toml` together, merge, then push the matching version tag, for example `v0.1.0`. Tag builds must match the app version exactly. Only after validation and all installer jobs pass does the pipeline create a GitHub Release with every platform's installers and checksums. Tags with a prerelease suffix become prereleases and stay out of GitHub's latest stable release endpoint.

Windows is unsigned. macOS uses ad-hoc signing, not Developer ID signing or Apple notarization. Native OS security prompts can still occur; signing credentials can be added later. Public GitHub standard runners do not consume billed build minutes; artifact/cache storage remains subject to GitHub's account allowances.

The pipeline runs packaging tests, Rust lint/tests, a prepared-service smoke check, and checks the Node runtime/service inside the installed Windows package, macOS app, and extracted Linux packages. These checks cover startup, health, local Studio/overlay routes, and the Foundation default; they do not substitute for opening the native window and using OBS on each OS.

The Windows instructions below remain the tested installation walkthrough.

## Install

1. Download `Tavi Studio_<version>_x64-setup.exe` (and optionally the `.sha256` file next to it).
2. Optional: check the download. In PowerShell, run `Get-FileHash '.\Tavi Studio_0.1.0_x64-setup.exe'` and compare the result with the `.sha256` file.
3. Run the installer. It installs for your Windows user only and does not ask for administrator rights.
4. **Windows SmartScreen warning.** The installer is not code-signed yet, so Windows may show "Windows protected your PC". Click **More info**, then **Run anyway**. Do this only for an installer you downloaded from the Tavi project. Some antivirus tools may also scan or delay an unsigned installer the first time.
5. Start **Tavi Studio** from the Start menu (or the desktop shortcut, if you chose one).

Opening Tavi Studio again while it is running brings the existing window to the front instead of starting a second copy.

To uninstall, use **Settings > Apps > Installed apps > Tavi Studio > Uninstall**. Your character settings stay in the data folder (see below) unless you delete that folder.

## Add Tavi to OBS

Keep Tavi Studio open while you stream. Closing it stops the overlay.

1. In OBS, open the scene you want, and under **Sources** click **+**, then **Browser**.
2. Set **URL** to `http://127.0.0.1:4318/overlay`.
3. Set **Width** and **Height** to your canvas size (for example 1920 x 1080).
4. Leave **Custom CSS** at the OBS default or clear it. The overlay background is transparent.
5. Optional: turn on **Refresh browser when scene becomes active**.

Changes you make in the studio (name, personality, placement, reactions, quiet mode, tuck away) appear in OBS right away. If you start Tavi Studio after OBS, the overlay reconnects on its own; if it stays blank, right-click the source and choose **Refresh**.

In the studio, **Open the overlay** opens the overlay in your normal browser so you can preview it. Setup also gives the link for the OBS dock (`/dock`), Studio's live controls in an OBS **Custom Browser Dock**.

## Twitch chat

Tavi Studio opens on a sign-in screen: **Connect with Twitch**, or **Skip for now** and connect later in **Setup › Let her hear chat**. Twitch sign-in is kept in memory, so after restarting Tavi the screen asks you to reconnect (unless you skipped it). Tavi shows a code; **Authorize on Twitch** opens `https://www.twitch.tv/activate` in your default browser, where you sign in and enter the code if asked. Tavi only asks for read access to chat. Live chat reactions are bounded rules, not AI.

## Where Tavi stores things

| What                 | Where                                                          |
| -------------------- | -------------------------------------------------------------- |
| App files            | `%LOCALAPPDATA%\Tavi Studio\`                                  |
| Character settings   | `%APPDATA%\app.tavi.studio\character.json`                     |
| Service log          | `%APPDATA%\app.tavi.studio\service.log`                        |
| WebView data         | `%LOCALAPPDATA%\app.tavi.studio\EBWebView\`                    |
| Third-party licenses | `%LOCALAPPDATA%\Tavi Studio\resources\THIRD-PARTY-NOTICES.txt` |

Paste a path into the File Explorer address bar to open it. Twitch sign-in is kept in memory only and is not written to disk; connect again after restarting Tavi.

## Troubleshooting

- **"Port 4318 is already in use."** Another program is using the overlay port. Usually this is a second Tavi service, such as a development server started with `npm run dev`. Close it (or restart your PC) and open Tavi Studio again. Tavi never stops other programs for you.
- **"The Tavi service stopped unexpectedly" or "did not start within 20 seconds."** Open `service.log` (path above) and look at the last lines. Antivirus software quarantining `resources\runtime\node.exe` can cause this; restore it or reinstall.
- **OBS shows nothing.** Check that Tavi Studio is open, that the URL is exactly `http://127.0.0.1:4318/overlay`, and that the character is not tucked away or in quiet mode. Then refresh the browser source.
- **Settings did not save.** Check that `%APPDATA%\app.tavi.studio\` is writable, and look in `service.log`.
- **Reset Tavi.** Close the app and delete `%APPDATA%\app.tavi.studio\character.json`.
- **The window is blank.** Repair or reinstall Microsoft Edge WebView2 Runtime from Microsoft, then restart Tavi Studio.

## How the app works

- The Tauri 2 shell (`src-tauri/`) starts the bundled `resources/runtime/node.exe resources/service/server.mjs` with `TAVI_DATA_DIR` set to the per-user app data folder, writes its output to `service.log`, waits for `/api/health`, and then opens the studio at `http://127.0.0.1:4318/studio` (the site root is the public landing page).
- The service runs inside a Windows job object with "kill on close", so it stops when Tavi exits, crashes, or is ended from Task Manager. A normal exit also stops it directly.
- If port 4318 is taken, or the service fails to start, the app shows an error dialog and exits. It never stops or reuses another process.
- The studio is an ordinary loopback web page, so the relative `/ws` and `/api` URLs and the service's origin checks work unchanged, and the renderer does not depend on Tauri.
- Page JavaScript gets no Tauri commands. No capabilities are granted. The opener plugin is called only from Rust. Links that open a new window or leave the app go through `src/links.rs`: `https://www.twitch.tv/activate` and the studio's `/overlay` and `/credits/` pages open in the default browser, and everything else is blocked.
- Only one copy runs at a time (single-instance plugin).
- `TAVI_PORT` (environment variable, default 4318) moves the app and its service to another port. It is meant for testing next to a development server. OBS instructions assume 4318.

## Build from source

Requirements: Windows x64, Node.js 22.12 or newer (LTS recommended; this Node binary is copied into the installer), Rust stable with the MSVC toolchain, Visual Studio C++ Build Tools, and WebView2.

```powershell
npm ci                 # repository root
cd desktop
npm ci
npm run release        # builds the installer and prints its path, size, and SHA-256
```

The installer is written to `desktop/src-tauri/target/release/bundle/nsis/Tavi Studio_<version>_x64-setup.exe`, with a `.sha256` file next to it. `npm run build` runs the same Tauri build without the version check and summary.

`scripts/prepare-service.mjs` runs automatically before the Tauri build. It regenerates `desktop/resources/`, which is gitignored:

- type-checks and builds the studio and overlay (`dist/`);
- bundles `service.ts` with esbuild;
- installs exactly the npm packages the bundled service imports, at the root's versions;
- copies the native build machine's Node runtime (`node.exe` on Windows, `node` on Unix), executable permissions, and LICENSE;
- writes `THIRD-PARTY-NOTICES.txt`, which covers the Node runtime, every production npm package, the linked Rust crates, and the CC BY 4.0 mascot attribution from `public/credits/`.

The version is set only in `desktop/package.json`. `tauri.conf.json` reads it from there, and `npm run release` fails if `src-tauri/Cargo.toml` has a different version.

Development: `npm run dev` (in `desktop/`) starts the root service on 4318 and Vite on 5173, then opens the native window on Vite. Close any other dev servers first. In development OBS uses `http://127.0.0.1:5173/overlay`.

Icon: `npm run icon -- http://127.0.0.1:4318 icon-source.png` renders a 1024 px icon from the running overlay's mascot. Then run `npx tauri icon icon-source.png`. The macOS pipeline generates its `.icns` from the committed `icons/icon.png` with `npm run prepare:icons`. The icon adapts the CC BY 4.0 mascot artwork by alisketch (see `public/credits/`).

### Verification tools

- `node scripts/verify-running.mjs http://127.0.0.1:4318 [screenshotDir]` checks a running service in headless Chromium: health, studio, overlay transparency, Rive WASM and `.riv` loading, and console, CSP, and HTTP errors.
- `node scripts/verify-webview.mjs http://127.0.0.1:9333 [--open-twitch]` connects to the real app window. Start the app with `$env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS='--remote-debugging-port=9333'` first. It checks rendering in WebView2, that page JS cannot call the opener, that untrusted pop-ups and navigation are blocked, and that the Twitch link goes to the system browser.
- `cargo clippy --all-targets -- -D warnings` and `cargo test` in `src-tauri/`. The tests cover the link policy.

### CI

See the cross-platform build pipeline above. Build jobs need no signing secrets; only the tag-only release job receives `contents: write` through the repository token.

### Code signing

Installers are unsigned. Until a code-signing certificate is configured (`bundle.windows.certificateThumbprint` or a `signCommand` in `tauri.conf.json`, plus a CI secret), Windows shows SmartScreen's "unknown publisher" warning for the installer, and each new unsigned build starts with no reputation. Signing lets SmartScreen reputation accumulate on the certificate instead of on each file, so the warning stops once that certificate has enough reputation.

## Verification status

Last checked on Windows 11 (26200), WebView2 155, Node 26.3.1 bundled, with the 0.1.0 installer built by `npm run release`. Port 4318 was taken by a development server during the run, so the installed app ran on `TAVI_PORT=4401`. It used the same code path as 4318, and the 4318 refusal was tested separately.

Verified on the installed app:

- Silent install (`/S`) for the current user: files in `%LOCALAPPDATA%\Tavi Studio`, Start menu shortcut, an entry in Installed apps (publisher and version), exe version 0.1.0. Installing over an existing install also worked.
- With 4318 taken, the app shows the "port 4318 is already in use" dialog, starts no service, and exits with code 1.
- A service that fails to start shows the "service stopped unexpectedly" dialog with the log path. This was hit by a real bug that is now fixed.
- The service started within about 1 s, `/api/health` returned ok, and `service.log` was written to `%APPDATA%pp.tavi.studio`.
- The native window shows the studio with the Rive mascot, "Local service connected", and the app icon in the title bar.
- Over CDP in the real WebView2 window: Rive WASM and `.riv` loaded, with no CSP or page errors. Page JS calling `plugin:opener|open_url` was rejected by the ACL. `window.open` to an untrusted site and top-level navigation away were blocked. `window.open('https://www.twitch.tv/activate')` produced no app window and was handed to the opener. Whether a browser tab actually opened was not confirmed visually.
- `/overlay` from the installed service in Chromium: transparent background, mascot rendered, WASM and `.riv` loaded.
- A name change over the WebSocket was saved to `character.json` in app data and was still there after a restart.
- Closing the window stopped the service. Force-killing `tavi-studio.exe` (Task Manager style) also stopped `node.exe` through the job object. No orphan processes were left.
- A second launch exits immediately (code 0) and leaves the first instance running.
- Silent uninstall removes the app files, shortcut, and uninstall entry, and keeps the user data folder.

Not yet verified (needs a person):

- An actual OBS Browser Source pointed at `http://127.0.0.1:4318/overlay`, including reconnecting after Tavi restarts.
- The interactive installer UI, the SmartScreen prompt on a downloaded copy, and a desktop shortcut.
- A clean machine or VM without Node, Rust, or developer tools, including a Windows 10 machine that needs the WebView2 bootstrapper.
- The full Twitch device-code sign-in in the installed app, and that the system browser tab opens visibly.
- Running on the default port 4318 end to end. Only the occupied-port refusal was exercised on 4318.
- High-DPI and small-screen window sizing on other monitors.
- Native UI and OBS acceptance checks for the new Linux and macOS builds.
- Microphone permissions (no microphone feature exists yet).
