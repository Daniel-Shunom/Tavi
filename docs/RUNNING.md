# Run the proof of concept

Requirements: Node.js 22.12+ (use the same Node major across machines), npm, and Python 3.10+ for skill verification.

```powershell
npm ci
python tools/skills.py
npm run dev
```

Open http://127.0.0.1:5173 for the cinematic landing page, or visit http://127.0.0.1:5173/studio to customize the character, try gestures, and compare cozy, playful, and shy personalities in the reaction playground. Character changes are saved by the Node service to `.data/character.json` and synchronized with all connected previews.

In OBS, add a Browser Source with URL `http://127.0.0.1:5173/overlay`, width 1280 and height 720. Keep the local service running. The overlay contains only the character with a transparent background. The studio's webcam/chat panels are placement guides, not OBS source detection. Peeking currently happens at the canvas edge.

To run the production build:

```powershell
npm run build
npm start
```

Landing page: http://127.0.0.1:4318. Studio: http://127.0.0.1:4318/studio. OBS overlay: http://127.0.0.1:4318/overlay.
