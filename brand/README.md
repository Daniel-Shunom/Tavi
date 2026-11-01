# Tavi brand and submission assets

Everything here is rendered from Tavi's real renderer footage and real app screenshots, in the look of the 45-second ad. Sources: `video/src/brand/Brand.tsx`. Regenerate with:

```sh
cd video
node capture/render-brand.mjs               # all stills (or pass an id filter, e.g. gallery)
node capture/screenshots.mjs http://127.0.0.1:4335   # app screenshots; serve the built app first
python capture/emote-sizes.py               # from the repo root: 112/56/28 emote sizes
```

## Hackathon (Devpost, YouTube)

| File | Size | Use |
| --- | --- | --- |
| `hackathon/devpost-thumbnail-1500x1000.png` | 3:2 | Devpost project thumbnail |
| `hackathon/gallery-1…7-*.png` | 3:2 | Devpost image gallery, in story order (gallery 5–7 are real Studio screenshots) |
| `hackathon/app-headshot-*.png` | 16:9, 3:2 (2x) | Hero image: Tavi waving, tilted, beside the wordmark |
| `hackathon/youtube-thumbnail-1280x720.png` | 16:9 | Thumbnail for the demo video |

## Screenshots

`screenshots/` holds real captures of the running app at 3840×2160: the landing page, Studio (Live, Look, Personality, Setup) and the transparent OBS overlay. Studio is shown with its default local service port. Your live stream recording should be the "in use on stream" evidence.

## Logo

`logo/tavi-wordmark.png` (dark), `logo/tavi-wordmark-light.png` (for dark backgrounds), `logo/tavi-lockup.png` (icon + wordmark) and `logo/tavi-icon-1024.png` (app icon tile). All transparent PNGs. The desktop app's installed icon (`desktop/src-tauri/icons`) is unchanged.

## Store (Microsoft Store listing art)

`store/hero-art-16x9-3840x2160.png` (no text, per Store guidance), `store/box-art-1x1-2160x2160.png`, `store/poster-art-2x3-1440x2160.png`. For Store screenshots, use `screenshots/`.

## Expressions and Twitch emotes

`expressions/tavi-*.png`: 1024 px transparent full-body cutouts of nine expressions (wave, hype, lol, shocked, hmm, ooh, smug, cheer, happy).
`emotes/tavi-*-{448,112,56,28}.png`: transparent head crops at Twitch's emote sizes.

## Social

`social/og-image-1200x630.png`: link preview card.

## Credits and rules of use

- **Character art** (see `CREDITS.md` for paste-ready credits and what the licence asks): "Mascot / Avatar Customization" by alisketch, CC BY 4.0 (https://rive.app/marketplace/27479-51911-mascot-avatar-customization/). Every image of Tavi here is an adaptation of it. Credit alisketch wherever these assets are published (Devpost description, Store listing, video description). See `public/credits/rive-avatar.md`.
- **Twitch and OpenAI marks** (simple-icons glyphs) appear only to name the hackathon. They belong to their owners; check the event's brand guidelines before publishing.
- **Chat in the images** is illustrative; real reactions follow rules and cooldowns. The images make no AI claims.
