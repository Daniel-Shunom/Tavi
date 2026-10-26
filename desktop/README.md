# Tavi Studio desktop

Windows-first Tauri 2 shell for the existing React studio. Frontend files, root scripts, and shared service contracts remain owned by the main task.

## Development

Install Rust (MSVC toolchain), Microsoft C++ Build Tools, and WebView2. Install the root npm dependencies first, then:

```powershell
cd desktop
npm install
npm run dev
```

This starts the local service on 4318 and Vite on 5173, then opens the native studio. Close existing root dev servers first; occupied ports cause startup to fail. OBS uses `http://127.0.0.1:5173/overlay` during development.

## Windows installer

```powershell
cd desktop
npm run build
```

Packaging type-checks/builds the current frontend, bundles the service entry point, installs its production dependencies, and includes the build machine's Windows x64 Node runtime and license. The build machine needs Node and network access; end users do not need Node. The installer is emitted under `src-tauri/target/release/bundle/nsis/`.

The installed app starts its owned service, waits for health readiness, and opens the studio from `http://127.0.0.1:4318`. OBS uses `http://127.0.0.1:4318/overlay`. Closing Tavi stops its service; keep Tavi open while streaming. Existing services are not terminated or reused. Character configuration and service logs are stored in Tauri's per-user app data directory for `app.tavi.studio`.

The frontend runs as a loopback web page in both environments, so existing relative `/ws` connections and WebSocket origin checks work without frontend changes. No shell or filesystem commands are exposed to page JavaScript.

## Verification still required before submission

Test the installed executable on Windows, microphone permissions in WebView2, OBS reload/reconnect behavior, occupied-port errors, process cleanup, and installation on a clean machine. Microphone and Twitch functionality depend on the main application implementation. The first installer is unsigned. Review bundled dependency licenses and runtime notices before distribution.

## Setup validation

Verified during setup: frontend TypeScript check and Vite production build, Rust `cargo check`, Tauri environment discovery, and an isolated packaged-service smoke test covering health, studio/overlay HTTP routes, WebSocket configuration changes, and file persistence. The actual native window and installer have not yet been exercised.

The checked-in icon is a simple code-drawn placeholder, independent of the frontend artwork.
