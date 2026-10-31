// Shot list for video/capture/tavi.mjs. Each shot is a scripted performance on the stage page;
// `actions` run at the given second (stage time) and talk to window.stage (capture/stage/stage.tsx).
// Frames land in video/public/footage/tavi/<name>/ as transparent PNGs at `fps`.
// Note: the renderer keeps her at the default home (x 0.23, feet at y 0.72 of the overlay) until a
// move cue; `config` x/y does not relocate her, so frame shots around that spot.
export const fps = 30;

const overlay = { presentation: 'overlay', width: 1920, height: 1080, scale: 1.5 };
const portrait = { presentation: 'portrait', width: 1080, height: 1080, scale: 2.5 };
const face = { presentation: 'portrait', width: 1080, height: 1080, scale: 2 };

/** Seconds between expressions in a mood reel; the montage samples each at `moodPeak`. */
export const moodGap = 2.3;
export const moodPeak = 1.35;
const reel = (ids) =>
  ids.map((id, index) => [
    0.4 + index * moodGap,
    `stage.perform({ expression: '${id}', intensity: 0.95, target: 'streamer' })`,
  ]);
export const moods = {
  'moods-a': ['excited', 'smug', 'shocked', 'eye-roll', 'sassy', 'proud'],
  'moods-b': ['confused', 'determined', 'wince', 'grin', 'agreeing', 'shrug'],
  'moods-c': ['sleepy', 'bored', 'point', 'celebrate', 'happy-dance', 'suspicious'],
};

/** @type {Record<string, {presentation:string,width:number,height:number,scale:number,seconds:number,config?:object,actions:[number,string][]}>} */
export const shots = {
  // The chat beat, portrait size: she listens, then reacts to each message in turn.
  chat: {
    ...face,
    seconds: 13,
    actions: [
      [
        0.4,
        `stage.perform({ expression: 'listening', intensity: 0.8, target: 'chat', hold: 2.2 })`,
      ],
      [2.8, `stage.perform({ expression: 'startled', intensity: 0.95, target: 'chat' })`],
      [4.6, `stage.perform({ expression: 'laugh', intensity: 1, target: 'chat' })`],
      [7.2, `stage.perform({ expression: 'thank-you', intensity: 0.95, target: 'chat' })`],
      [9.8, `stage.perform({ expression: 'blush', intensity: 0.95, target: 'chat' })`],
    ],
  },
  // Mood reels for the montage: one expression every `moodGap` seconds.
  ...Object.fromEntries(
    Object.entries(moods).map(([name, ids]) => [
      name,
      { ...face, seconds: 0.4 + ids.length * moodGap + 0.6, actions: reel(ids) },
    ]),
  ),
  // The reveal and every extreme close-up: big, centred, face forward.
  hero: {
    ...portrait,
    seconds: 17,
    actions: [
      [0.4, `stage.perform({ expression: 'content', intensity: 0.5, hold: 1.6 })`],
      [2.6, `stage.perform({ expression: 'wave', intensity: 0.95, target: 'streamer' })`],
      [5.2, `stage.perform({ expression: 'grin', intensity: 0.9, hold: 1.4 })`],
      [7.0, `stage.perform({ expression: 'excited', intensity: 1, hold: 1.6 })`],
      [9.2, `stage.perform({ expression: 'shocked', intensity: 0.9, hold: 1.1 })`],
      [10.8, `stage.perform({ expression: 'laugh', intensity: 1 })`],
      [13.2, `stage.perform({ expression: 'smug', intensity: 0.9, hold: 1.4 })`],
      [14.8, `stage.perform({ expression: 'celebrate', intensity: 1 })`],
    ],
  },
  // Chat reactions, overlay size, standing mid-frame.
  reactions: {
    ...overlay,
    seconds: 22,
    config: { x: 0.5, y: 0.9 },
    actions: [
      [0.4, `stage.perform({ expression: 'listening', intensity: 0.7, target: 'chat', hold: 2 })`],
      [2.8, `stage.perform({ expression: 'startled', intensity: 0.9, target: 'chat' })`],
      [4.6, `stage.perform({ expression: 'laugh', intensity: 1, target: 'chat' })`],
      [7.2, `stage.perform({ expression: 'thank-you', intensity: 0.9, target: 'chat' })`],
      [9.8, `stage.perform({ sequence: 'big-win', intensity: 1, target: 'chat' })`],
      [14.0, `stage.perform({ expression: 'sassy', intensity: 0.9, target: 'chat' })`],
      [16.2, `stage.perform({ expression: 'eye-roll', intensity: 0.8, target: 'chat' })`],
      [18.2, `stage.perform({ expression: 'blush', intensity: 0.9, target: 'chat' })`],
      [20.0, `stage.perform({ expression: 'happy-dance', intensity: 1 })`],
    ],
  },
  // Locomotion across the full width: run, skip back, hop to the middle.
  run: {
    ...overlay,
    seconds: 12,
    config: { x: 0.1, y: 0.9 },
    actions: [
      [0.4, `stage.move({ to: { x: 0.9, y: 0.9 }, gait: 'run', speed: 1 })`],
      [5.0, `stage.move({ to: { x: 0.14, y: 0.9 }, gait: 'skip', speed: 0.9 })`],
      [9.2, `stage.move({ to: { x: 0.5, y: 0.9 }, gait: 'hop', speed: 1 })`],
    ],
  },
  // Walks to the webcam frame, climbs up, waves from the top, then back down.
  perch: {
    ...overlay,
    seconds: 15,
    config: { x: 0.4, y: 0.85 },
    actions: [
      [0.4, `stage.body('perch')`],
      [8.0, `stage.perform({ expression: 'wave', intensity: 0.9, target: 'streamer' })`],
      [11.0, `stage.body('stand')`],
    ],
  },
  // A quiet beat: sits, dozes off, wakes up.
  nap: {
    ...overlay,
    seconds: 13,
    config: { x: 0.5, y: 0.9 },
    actions: [
      [0.4, `stage.body('sit', { prefer: 'floor' })`],
      [4.0, `stage.body('nap', { prefer: 'floor' })`],
      [10.5, `stage.body('stand')`],
    ],
  },
  // Walks over to the chat panel and peeks at it.
  peek: {
    ...overlay,
    seconds: 9,
    config: { x: 0.5, y: 0.9 },
    actions: [[0.4, `stage.body('peek')`]],
  },
  // Drops in from the top of the frame and lands: the reveal.
  drop: {
    ...overlay,
    seconds: 6,
    config: { x: 0.5, y: 0.9 },
    actions: [
      [0, `stage.hide()`],
      [0.6, `stage.presence('enter', 'drop')`],
    ],
  },
};
