# Tavi — 45-second ad

Composition `Ad45` (`src/ad/`), 1920×1080, 30 fps. Directed with `.agents/skills/cinematic-director` (Spielberg lens: reaction before reveal) and built with the Remotion skills. Every frame of Tavi is the real renderer, captured as transparent PNGs by `capture/tavi.mjs`.

## Direction

- **Say less.** Five short titles, nothing more: "Introducing Tavi" (your Twitch streaming companion), "Reacts to chat.", "Feels every moment.", "Lives on your stream.", and "Make your stream feel more alive." Chat bubbles, Tavi's acting and the product UI carry the rest.
- **White product film.** Paper white, soft grey shadows, aubergine type, a whisper of colour behind her that follows the feeling.
- **Relaxed and smooth.** Cuts every two beats (1.2 s) with soft dissolves; slow push-ins; no flashes or shakes.
- **Visual thesis.** Chat is loud; the spot where someone should stand holds only a shadow. On the drop she rises out of it.
- **Arc.** Absence → glimpses → chat calls for her → she arrives → she answers chat → range of feeling → she lives on the stream → Studio → quiet → the big moment → sign-off.

## Music edit

"Tell Each Other How We Feel" (user supplied, `public/audio/tell-each-other.mp3`, not committed). 100 BPM: beat 0.6 s, bar 2.4 s.

| Ad time | Track time | Section |
| --- | --- | --- |
| 0.0–10.2 | 37.765–47.965 | Pickup and build, breath before the drop |
| 10.2–39.0 | 47.965–76.765 | Three full phrases from the drop |
| 39.0–45.0 | 191.965–197.965 | The song's own ending, spliced on a phrase downbeat |

## Shot list

| # | Time | Shot | Sound |
| --- | --- | --- | --- |
| 1 | 0.0–5.4 | White room, an empty floor shadow, chat bubbles pop in on the beat; slow push | A blip per message |
| 2 | 5.4–7.8 | Two extreme close-ups of her (eyes, then a smile), drifting, dissolving | Soft whooshes |
| 3 | 7.8–11.4 | Chat asks "where's tavi? 👀"; on the drop she floats up through her shadow, already animated | Blip, rising chime |
| 4 | 11.4–15.0 | The same continuous take: she greets; the camera pans her to the right third; "Introducing Tavi" | Long whoosh |
| 5 | 15.0–19.8 | Three messages, three reactions, each after its message ("Scripted demo") | Blips |
| 6 | 19.8–24.6 | Four feelings, close, the colour behind her changing | Breaths of air |
| 7 | 24.6–29.4 | The stream floats on white; the camera travels in to find her running | Long whoosh, quiet blips |
| 8 | 29.4–34.2 | Studio as a product window: Look, Live, Setup | Whoosh, clicks |
| 9 | 34.2–36.6 | Quiet mode switches on; the room cools and goes still | Click |
| 10 | 36.6–39.0 | Chat erupts; she celebrates | Chord, blips |
| 11 | 39.0–45.0 | Wordmark, "Make your stream feel more alive.", "Built for the Twitch × Codex hackathon", Twitch and Codex marks; she waves beside it | Shimmer, the song's tail |

## Sound

`capture/make-sfx.py` synthesizes every effect into `public/sfx/` (original, no samples): pentatonic chat blips, filtered-noise whooshes, an arrival chime, a UI click, a closing shimmer and a celebration chord. The cue sheet is `sfx` in `src/ad/Ad.tsx`. The mix peaks at about −2 dBFS.

## Honesty rules

The chat reactions are labelled "Scripted demo". The ad never claims AI, voice or microphone features. The Twitch and OpenAI glyphs (simple-icons paths, `src/ad/marks.ts`) only name the hackathon. Confirm the music licence and event brand guidelines before publishing.

## Render

```sh
npm run render:ad      # out/tavi-ad-45.mp4
npx remotion studio    # preview; open the Ad45 composition
```

Footage comes from `npm run capture`. The ad uses the reveal, hero, chatread, alive-a, alive-b, romp and outro shots, plus the Studio screen sequence. `src/ad/shots.json` (from `npm run measure:ad`) holds her measured bounding box for every captured frame, so the framing is exact. Regenerate it after recapturing.
