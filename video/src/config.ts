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
    /** Your walkthrough of setting Tavi up on stream (full frame, any length up to the slot). */
    setup: 'clips/setup.mp4',
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
      /** A facecam-style bubble of her reacting, for beats whose media is a screen. */
      cameo?: TaviMedia;
      media:
        | TaviMedia
        | {
            type: 'screen';
            /** A captured sequence folder (with frames) or a video file. */
            src: string;
            frames?: number;
            from?: number;
            zoom?: [number, number];
            focus?: [number, number];
          }
        | { type: 'clip'; src: string; fallback: TaviMedia };
    }
  | {
      /** Simulated chat lines pop in and she reacts to each one (the `chat` capture). */
      kind: 'chat';
      at: number;
      eyebrow: string;
      headline: string;
      sub?: string;
      media: TaviMedia;
      messages: {
        at: number;
        user: string;
        text: string;
        tone?: 'pink' | 'teal' | 'mint' | 'lavender';
      }[];
    }
  | {
      /** Fast cuts through the mood reels, one expression per cut with its name. */
      kind: 'montage';
      at: number;
      eyebrow: string;
      cutSeconds: number;
      cuts: { shot: TaviShot; index: number; label: string }[];
    }
  | {
      /** A full-frame slot for your own footage, with a small label; a placeholder until it exists. */
      kind: 'slot';
      at: number;
      eyebrow: string;
      src: string;
    }
  | { kind: 'outro'; at: number };

export type TaviShot =
  | 'hero'
  | 'reactions'
  | 'run'
  | 'perch'
  | 'nap'
  | 'peek'
  | 'drop'
  | 'chat'
  | 'moods-a'
  | 'moods-b'
  | 'moods-c'
  | 'alive-a'
  | 'alive-b'
  | 'reveal'
  | 'chatread'
  | 'romp'
  | 'chatwalk'
  | 'quiet'
  | 'outro';

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
  /** Camera follows her (see TaviClip). */
  follow?: { part?: 'body' | 'head' | 'feet'; smooth?: number };
  mirror?: boolean;
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

/** Face-only framing for a cameo bubble: the capture's face (0.5, 0.58) fills the box. */
const cameoFrame = {
  zoom: 2.6,
  focus: [0.5, 0.57] as [number, number],
  anchor: [0.5, 0.5] as [number, number],
};

/** Head and shoulders, for the portrait captures shown full frame. */
const faceFrame = { zoom: 1.5, focus: [0.5, 0.63] as [number, number] };

/** Overlay captures (she is small in them): a camera that follows her, right of the headline. */
const followFrame = {
  zoom: 2.4,
  follow: { part: 'body' as const, smooth: 10 },
  anchor: [0.68, 0.56] as [number, number],
};

export const timeline: Beat[] = [
  { kind: 'tease', at: 0 },
  { kind: 'reveal', at: 9.4 },
  {
    kind: 'chat',
    at: 16,
    eyebrow: 'She reads your chat',
    headline: 'Reacts to every message.',
    sub: 'Bounded rules, zero AI roulette.',
    // The chatread capture: impressed 0.3 s, laugh 1.7, startled 3.4, shocked then laughing 4.4,
    // nodding 7.2, excited 8.6, grin 10.0. Each line lands just before her reaction.
    media: { type: 'tavi', shot: 'chatread', from: 0, ...faceFrame, anchor: [0.58, 0.56] },
    messages: [
      { at: 0.1, user: 'pogchamp_dan', text: 'wait is she reading chat??', tone: 'teal' },
      { at: 1.4, user: 'k3v', text: 'LMAOOO', tone: 'lavender' },
      { at: 3.1, user: 'mira', text: 'BOO', tone: 'pink' },
      { at: 4.1, user: 'lux_tv', text: 'gifted 5 subs to the community!', tone: 'mint' },
      { at: 6.9, user: 'noodle', text: 'she agrees with me btw', tone: 'pink' },
      { at: 8.3, user: 'raidbot', text: 'big_tim is raiding with 240 viewers', tone: 'teal' },
      { at: 9.7, user: 'pogchamp_dan', text: 'tavi is so cute omg', tone: 'lavender' },
    ],
  },
  {
    kind: 'montage',
    at: 27.5,
    eyebrow: 'A face for everything',
    cutSeconds: 0.5,
    cuts: [
      { shot: 'alive-a', index: 0, label: 'excited' },
      { shot: 'alive-b', index: 0, label: 'hi!' },
      { shot: 'alive-a', index: 1, label: 'laugh' },
      { shot: 'alive-a', index: 2, label: 'shocked' },
      { shot: 'alive-b', index: 2, label: 'celebrate' },
      { shot: 'alive-a', index: 3, label: 'agree' },
      { shot: 'alive-b', index: 1, label: 'confused' },
      { shot: 'alive-a', index: 4, label: 'wince' },
      { shot: 'alive-b', index: 3, label: 'nope' },
      { shot: 'alive-a', index: 5, label: 'grin' },
      { shot: 'alive-b', index: 5, label: 'eye roll' },
      { shot: 'alive-a', index: 6, label: 'startled' },
    ],
  },
  {
    kind: 'feature',
    at: 33.5,
    eyebrow: 'Lives on your stream',
    headline: 'Right there in OBS.',
    sub: 'Transparent overlay, one browser source.',
    media: {
      type: 'clip',
      src: files.clips.stream,
      fallback: { type: 'tavi', shot: 'romp', from: 4.4, ...followFrame },
    },
  },
  {
    kind: 'feature',
    at: 40.5,
    eyebrow: 'Knows the room',
    headline: 'Walks over to chat.',
    sub: 'She knows where your panels are.',
    // The chatwalk capture: crosses to the chat side, then keeps reacting to it.
    media: { type: 'tavi', shot: 'chatwalk', from: 0.1, ...followFrame },
  },
  {
    kind: 'feature',
    at: 48,
    eyebrow: 'Tune her in Studio',
    headline: 'Your rules. Her moves.',
    sub: 'Look, personality, hotkeys, scene.',
    cameo: { type: 'tavi', shot: 'alive-a', from: 0.2, ...cameoFrame },
    media: {
      type: 'screen',
      src: 'footage/screens/studio',
      frames: 784,
      from: 3,
      zoom: [1.05, 1.18],
      focus: [0.5, 0.45],
    },
  },
  {
    kind: 'feature',
    at: 56,
    eyebrow: 'Meet her on the site',
    headline: 'Scroll. She follows.',
    cameo: { type: 'tavi', shot: 'alive-b', from: 0.2, ...cameoFrame },
    media: {
      type: 'screen',
      src: 'footage/screens/landing',
      frames: 1205,
      from: 5,
      zoom: [1, 1.12],
      focus: [0.5, 0.5],
    },
  },
  {
    kind: 'feature',
    at: 62.5,
    eyebrow: 'Even when it is quiet',
    headline: 'She keeps busy.',
    sub: 'Thinks, fidgets, glances around, and perks up the second chat moves.',
    // The quiet capture: thinking, glancing, fidgeting, then startled by chat, laughing, waving.
    media: { type: 'tavi', shot: 'quiet', from: 1.4, ...followFrame },
  },
  // Your stream-setup walkthrough: drop it at video/public/clips/setup.mp4. Change the outro's
  // `at` (and totalSeconds) to fit its length.
  { kind: 'slot', at: 68.5, eyebrow: 'Set her up on stream', src: files.clips.setup },
  { kind: 'outro', at: 83.5 },
];

export const totalSeconds = 93;
