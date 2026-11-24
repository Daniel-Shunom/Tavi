# Tavi Studio desktop

[Download Tavi](https://tavi-pi.vercel.app/download) for Windows, macOS or Linux. The app includes its own runtime; no development tools are needed.

## Setup

1. Install and open Tavi Studio.
2. In **Setup**, copy the overlay URL into an OBS **Browser Source**.
3. Match the source dimensions to your OBS canvas and keep Tavi open while streaming.

Connect Twitch from **Setup** and approve access in your browser. [YouTube setup (beta)](../docs/YOUTUBE.md) requires an approved Google test account.

## Build

Install Node.js 22.12+, Rust and the [Tauri platform prerequisites](https://v2.tauri.app/start/prerequisites/), then run:

```sh
npm ci
cd desktop
npm ci
npm run release
```

See the [desktop reference](REFERENCE.md) for troubleshooting, packaging, updates, signing and verification.
