# Voiceover sheet

For recording and laying the voiceover in DaVinci Resolve. The trailer is 1:33 at 30 fps.
Timecodes are `MM:SS:FF` from the first frame.

## Files to bring into Resolve

| File                           | What it is                                              |
| ------------------------------ | ------------------------------------------------------- |
| `out/tavi-trailer.mp4`         | Picture with the music mixed in, for reference.         |
| `out/tavi-trailer-picture.mp4` | The same picture with no audio. Edit on top of this.    |
| `out/tavi-trailer-music.wav`   | The music bed on its own, trimmed and faded to the cut. |

Render them from `video/`:

```
npx remotion render Trailer out/tavi-trailer.mp4 --concurrency=2
npx remotion render Trailer out/tavi-trailer-picture.mp4 --props="{\"audio\":false}" --concurrency=2
npx remotion render Trailer out/tavi-trailer-music.wav --codec=wav
```

Duck the music bed under your voice in Resolve (Fairlight sidechain, or about -10 dB keyframes).
The cuts are timed to the music, so keep the bed in sync with the picture.

## Sections and suggested lines

Lines are suggestions sized to each window; read them at a relaxed pace. The tease and the
reveal hit hardest with music alone, so the voice starts after the drop.

| In       | Out      | Section                | On screen                                              | Suggested line                                                                  |
| -------- | -------- | ---------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------- |
| 00:00:00 | 00:09:12 | Tease (music only)     | Silhouette cuts, "your stream / is missing / someone." | None. Let it build.                                                             |
| 00:09:12 | 00:16:00 | Reveal, on the drop    | She waves, TAVI, tagline                               | (after the name lands, about 00:11:00) "Meet Tavi."                             |
| 00:16:00 | 00:27:15 | Chat                   | She reads and reacts to each message                   | "She reads your chat and reacts to every message. Your rules, not AI roulette." |
| 00:27:15 | 00:33:15 | Expression montage     | Twelve fast expression cuts                            | "A face for everything."                                                        |
| 00:33:15 | 00:40:15 | Lives on your stream   | Her on the overlay (or your OBS clip)                  | "She lives right on your stream. One browser source in OBS."                    |
| 00:40:15 | 00:48:00 | Knows the room         | She walks over toward chat and keeps reacting          | "She knows your layout, and walks over when chat gets loud."                    |
| 00:48:00 | 00:56:00 | Studio                 | Studio tour with her reacting in a bubble              | "Tune her look, her personality and her hotkeys in Tavi Studio."                |
| 00:56:00 | 01:02:15 | The site               | Landing page scroll with her bubble                    | "Say hi on the site. Scroll, and she follows."                                  |
| 01:02:15 | 01:08:15 | Quiet stream           | She fidgets and glances around, then perks up at chat  | "Slow night? She keeps busy, and perks up the second chat moves."               |
| 01:08:15 | 01:23:15 | Your setup walkthrough | Your clip, full frame (`public/clips/setup.mp4`)       | Your own narration of the setup steps.                                          |
| 01:23:15 | 01:33:00 | End card               | Tavi Studio, free for Windows, repo link               | "Tavi Studio. Free for Windows. Works with OBS."                                |

The chat lines on screen are a scripted demo and are labelled "demo chat". Keep the voiceover
consistent with that: her reactions are rules you configure, not a live AI.

## The setup slot

The slot runs 15 seconds and shows a labelled placeholder until `public/clips/setup.mp4` exists.
If your walkthrough is longer, move the outro's `at` and `totalSeconds` in `src/config.ts` by the
same amount, re-render, and shift the end-card line in this sheet. The music track runs out at
1:40, so keep the whole cut under that or loop the bed in Resolve.

## If you change the cut

Section times live in `src/config.ts` (`timeline`). Update this sheet if you move them.
