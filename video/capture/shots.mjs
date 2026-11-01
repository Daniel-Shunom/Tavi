// Shot list for video/capture/tavi.mjs. Each shot is a scripted performance on the stage page;
// `actions` run at the given second (stage time) and talk to window.stage (capture/stage/stage.tsx).
// Frames land in video/public/footage/tavi/<name>/ as transparent PNGs at `fps`.
// Note: the renderer keeps her at the default home (x 0.23, feet at y 0.72 of the overlay) until a
// move cue; `config` x/y does not relocate her, so frame shots around that spot.
export const fps = 30;

const overlay = { presentation: 'overlay', width: 1920, height: 1080, scale: 1.25 };
const portrait = { presentation: 'portrait', width: 1080, height: 1080, scale: 2.5 };
const face = { presentation: 'portrait', width: 1080, height: 1080, scale: 2 };
// Sized to what the composition shows (bigger frames only slow the render down).
const live = { presentation: 'portrait', width: 1080, height: 1080, scale: 1.5 };

// Dense acting: a cue roughly every second, only performances that visibly move the body or
// open the mouth (measured on the captures), so she never holds still on camera.
const act = (id, extra = '') =>
  `stage.perform({ expression: '${id}', intensity: 1, target: 'streamer'${extra} })`;
const seq = (id, target = 'streamer') =>
  `stage.perform({ sequence: '${id}', intensity: 1, target: '${target}' })`;
/** Alive reels: one expression every `liveGap` seconds; peaks are measured after capture. */
export const liveGap = 1.5;
export const lives = {
  'alive-a': ['excited', 'laugh', 'shocked', 'agreeing', 'wince', 'grin', 'startled'],
  'alive-b': ['wave', 'confused', 'celebrate', 'disagreeing', 'laugh', 'eye-roll', 'excited'],
};
const liveReel = (ids) => ids.map((id, index) => [0.3 + index * liveGap, act(id)]);

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

const liveShots = {
  ...Object.fromEntries(
    Object.entries(lives).map(([name, ids]) => [
      name,
      { ...live, seconds: 0.3 + ids.length * liveGap + 0.9, actions: liveReel(ids) },
    ]),
  ),
  // The reveal: she glances up, waves at the viewer and starts talking (greeting, then chatter).
  reveal: {
    ...live,
    scale: 1.5,
    seconds: 9.5,
    actions: [
      [0.2, seq('greeting')],
      [2.3, act('excited')],
      [3.5, act('laugh')],
      [4.9, act('wave')],
      [6.6, act('grin')],
      [7.6, act('excited')],
    ],
  },
  // The site's chat routine, played denser: reads, laughs, reacts to every message.
  chatread: {
    ...live,
    seconds: 12,
    actions: [
      [0.3, `stage.perform({ expression: 'impressed', intensity: 1, target: 'chat', hold: 1.2 })`],
      [1.7, `stage.perform({ expression: 'laugh', intensity: 1, target: 'chat' })`],
      [3.4, `stage.perform({ expression: 'startled', intensity: 1, target: 'chat' })`],
      [4.4, seq('shock-then-laugh', 'chat')],
      [7.2, `stage.perform({ expression: 'agreeing', intensity: 1, target: 'chat' })`],
      [8.6, `stage.perform({ expression: 'excited', intensity: 1, target: 'chat' })`],
      [10.0, `stage.perform({ expression: 'grin', intensity: 1, target: 'chat' })`],
    ],
  },
  // Silhouette and locomotion footage for the tease, then she celebrates where she lands.
  romp: {
    ...overlay,
    seconds: 13,
    config: { x: 0.1, y: 0.9 },
    actions: [
      [0.3, `stage.move({ to: { x: 0.9, y: 0.9 }, gait: 'run', speed: 1 })`],
      [4.6, `stage.move({ to: { x: 0.14, y: 0.9 }, gait: 'skip', speed: 1 })`],
      [8.8, `stage.move({ to: { x: 0.5, y: 0.9 }, gait: 'hop', speed: 1 })`],
      [11.4, act('celebrate')],
    ],
  },
  // Walks over to chat, then keeps reacting to it.
  chatwalk: {
    ...overlay,
    seconds: 9,
    config: { x: 0.5, y: 0.9 },
    actions: [
      [0.3, `stage.body('peek')`],
      [1.8, `stage.perform({ expression: 'impressed', intensity: 1, target: 'chat' })`],
      [3.0, `stage.perform({ expression: 'laugh', intensity: 1, target: 'chat' })`],
      [4.8, `stage.perform({ expression: 'agreeing', intensity: 1, target: 'chat' })`],
      [6.2, `stage.perform({ expression: 'excited', intensity: 1, target: 'chat' })`],
      [7.6, `stage.perform({ expression: 'laugh', intensity: 1, target: 'chat' })`],
    ],
  },
  // Quiet stream: she keeps herself busy, then perks up when a message lands.
  quiet: {
    ...overlay,
    seconds: 7.5,
    config: { x: 0.5, y: 0.9 },
    actions: [
      [0.3, act('thinking')],
      [1.6, act('idle-glance')],
      [2.6, act('idle-fidget')],
      [3.6, `stage.perform({ expression: 'startled', intensity: 1, target: 'chat' })`],
      [4.6, `stage.perform({ expression: 'laugh', intensity: 1, target: 'chat' })`],
      [6.0, act('wave')],
    ],
  },
  // The end card: waves goodbye, cheers.
  outro: {
    ...live,
    seconds: 9,
    actions: [
      [0.3, act('excited')],
      [1.6, act('wave')],
      [3.6, act('laugh')],
      [5.2, seq('big-win')],
    ],
  },
};

/** @type {Record<string, {presentation:string,width:number,height:number,scale:number,seconds:number,config?:object,actions:[number,string][]}>} */
export const shots = {
  ...liveShots,
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
