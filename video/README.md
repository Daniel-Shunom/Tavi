# Tavi trailer

A product trailer authored in [Remotion](https://www.remotion.dev): the cuts, zooms and type are
code, and every frame of Tavi comes from the real renderer, captured frame by frame with a
transparent background. Nothing in here changes the product.

## One-time setup

```sh
cd video
npm install
```

## 1. Capture footage

Footage is generated, not committed. From the repo root, serve the source with Vite and the built
site with the service, then capture:

```sh
npx vite --port 5190 --strictPort            # terminal 1, repo root
npm run build && TAVI_PORT=4325 npx tsx server/index.ts   # terminal 2, repo root
cd video && npm run capture                  # terminal 3
```

- `capture/tavi.mjs` opens `capture/stage/` (the overlay renderer fed a scripted state), freezes
  the browser clock and screenshots one frame at a time at 30 fps into `public/footage/tavi/`.
  The shot list is `capture/shots.mjs`; add a shot there and reference it from `src/config.ts`.
- `capture/screens.mjs` records the landing page scroll and a tour of Studio (dark theme) into
  `public/footage/screens/`.

Captures take a while (every frame is a full-resolution screenshot); `CAPTURE_PARALLEL=6` runs
more shots at once.

## 2. Add your own files (optional, never committed)

| File                         | Used for                                                           |
| ---------------------------- | ------------------------------------------------------------------ |
| `public/audio/track.mp3`     | The music. Cuts and punches are detected from its low end.         |
| `public/audio/voiceover.wav` | Your voiceover; the music ducks under it during the feature beats. |
| `public/clips/*.mp4`         | Your clips; `src/config.ts` names which beat shows which clip.     |

Without a track the cuts fall on a fixed grid (`fallbackBpm`). A missing clip shows a labelled
placeholder, and the Tavi fallback for that beat plays underneath it.

Use music you have the rights to use where the video will be shown.

## 3. Preview and render

```sh
npm run studio     # Remotion Studio: scrub the timeline in the browser
npm run render     # out/tavi-trailer.mp4 (1920x1080, 30 fps, H.264)
```

## Editing

- `src/config.ts`: the timeline (what happens when), the copy, your file names.
- `src/scenes.tsx`: how each kind of beat looks (tease, reveal, feature, outro).
- `src/fx.tsx`: grain, scanlines, flashes, aberration, glitch, shake.
- `src/audio.ts`: beat detection and the pulse that drives the punches.
