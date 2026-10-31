// Everything you are likely to tweak lives here: timing, copy, your own files.
// Times are seconds; the composition is 1920x1080 at 30 fps.

export const FPS = 30;
export const WIDTH = 1920;
export const HEIGHT = 1080;

/** Your files, dropped into video/public/ (never committed). Missing files are skipped. */
export const files = {
  /** The music track. Supply your own licensed audio; nothing is bundled. */
  music: 'audio/track.mp3',
  /** Voiceover; the music ducks under it while it plays. */
  voiceover: 'audio/voiceover.wav',
  /** Clips you shot yourself, referenced by the feature beats below. */
  clips: {
    stream: 'clips/stream.mp4',
    chat: 'clips/chat.mp4',
    studio: 'clips/studio.mp4',
    desk: 'clips/desk.mp4',
  },
};

/**
 * Seconds into the track to start from, so its drop lands on the reveal (9.5 s below).
 * For "The Only Thing They Fear Is You": find the second the main riff hits in your file and set
 * this to (that second - 9.5). 0 plays the track from the top.
 */
export const musicStart = 0;

/** When no music is present, cuts fall on this grid instead of detected hits. */
export const fallbackBpm = 132;

/**
 * The timeline. Each beat starts at `at` seconds and runs until the next one.
 *   tease   dark, fast cuts, extreme close-ups of a character you cannot quite see yet
 *   reveal  the drop: she lands, the name hits
 *   feature headline + footage (Tavi clip, screen capture, or your own clip)
 *   outro   name, platform, call to action
 */
export type Beat =
  | { kind: 'tease'; at: number }
  | { kind: 'reveal'; at: number }
  | {
      kind: 'feature';
      at: number;
      eyebrow: string;
      headline: string;
      sub?: string;
      media:
        | TaviMedia
        | {
            type: 'screen';
            src: string;
            from?: number;
            zoom?: [number, number];
            focus?: [number, number];
          }
        | { type: 'clip'; src: string; fallback: TaviMedia };
    }
  | { kind: 'outro'; at: number };

export type TaviShot = 'hero' | 'reactions' | 'run' | 'perch' | 'nap' | 'peek' | 'drop';

/**
 * A captured Tavi shot: `from` seconds into it, `zoom` (1 fits the capture's height to the frame),
 * `focus` the point of the capture (0..1) that lands on `anchor`, a point of the frame (0..1).
 * Feature beats keep the left for the headline, so anchor around x 0.68.
 */
export interface TaviMedia {
  type: 'tavi';
  shot: TaviShot;
  from?: number;
  zoom?: number;
  focus?: [number, number];
  anchor?: [number, number];
}

export const copy = {
  teaseLines: ['your stream', 'is missing', 'someone.'],
  name: 'TAVI',
  tagline: 'Your stream, with a little more life.',
  outro: {
    headline: 'Tavi Studio',
    sub: 'Free for Windows · works with OBS',
    cta: 'github.com/Daniel-Shunom/Tavi',
  },
};

export const timeline: Beat[] = [
  { kind: 'tease', at: 0 },
  { kind: 'reveal', at: 9.5 },
  {
    kind: 'feature',
    at: 16,
    eyebrow: 'She hears your chat',
    headline: 'Reacts to every message.',
    sub: 'Bounded rules, zero AI roulette.',
    media: {
      type: 'tavi',
      shot: 'reactions',
      from: 2.4,
      zoom: 2.4,
      focus: [0.23, 0.61],
      anchor: [0.68, 0.55],
    },
  },
  {
    kind: 'feature',
    at: 24,
    eyebrow: 'Lives on your stream',
    headline: 'Right there in OBS.',
    sub: 'Transparent overlay, one browser source.',
    media: {
      type: 'clip',
      src: files.clips.stream,
      fallback: {
        type: 'tavi',
        shot: 'run',
        from: 4.6,
        zoom: 1.15,
        focus: [0.55, 0.62],
        anchor: [0.62, 0.55],
      },
    },
  },
  {
    kind: 'feature',
    at: 32,
    eyebrow: 'Knows the room',
    headline: 'Climbs your webcam.',
    sub: 'Sits, naps, peeks at chat, wanders home.',
    media: {
      type: 'tavi',
      shot: 'perch',
      from: 1.2,
      zoom: 2.1,
      focus: [0.2, 0.6],
      anchor: [0.68, 0.55],
    },
  },
  {
    kind: 'feature',
    at: 40,
    eyebrow: 'Tune her in Studio',
    headline: 'Your rules. Her moves.',
    sub: 'Look, personality, hotkeys, scene.',
    media: {
      type: 'screen',
      src: 'footage/screens/studio.mp4',
      from: 3,
      zoom: [1.05, 1.18],
      focus: [0.5, 0.45],
    },
  },
  {
    kind: 'feature',
    at: 49,
    eyebrow: 'Meet her on the site',
    headline: 'Scroll. She follows.',
    media: {
      type: 'screen',
      src: 'footage/screens/landing.mp4',
      from: 5,
      zoom: [1, 1.12],
      focus: [0.5, 0.5],
    },
  },
  {
    kind: 'feature',
    at: 57,
    eyebrow: 'Even when it is quiet',
    headline: 'She is still there.',
    media: {
      type: 'tavi',
      shot: 'nap',
      from: 4.5,
      zoom: 2.2,
      focus: [0.23, 0.66],
      anchor: [0.68, 0.55],
    },
  },
  { kind: 'outro', at: 64 },
];

export const totalSeconds = 74;
