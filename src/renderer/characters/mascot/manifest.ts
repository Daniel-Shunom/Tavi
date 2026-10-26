// Mascot / Avatar Customization by alisketch (CC BY 4.0), artboard "lyla animation".
// Grounded in tools/rive-inventory.mjs and tools/rive-clip-sampler.mjs (see README.md):
// - Inactive at runtime (zero rendered change): face x/y, brow left/right, mouth X/Y,
//   mouth smile frown, blinks left/right, lower lid blinks, hair squash/swing, hairswoop,
//   squash stretch, Timeline 4. They are not bound.
// - "wave testing folio header" permanently rescales the artboard to ~65% and is excluded.
// - Every expression below is composed from verified full-body clips plus small host offsets;
//   this rig has no independently controllable brows, mouth or eyes.
import type { ManifestInput } from '../manifest';

export const mascot: ManifestInput = {
  id: 'mascot',
  name: 'Lyla (mascot)',
  credit: 'Mascot / Avatar Customization by alisketch (CC BY 4.0)',
  creditUrl: '/credits/rive-avatar.md',
  license: 'CC-BY-4.0',
  renderer: 'rive',
  asset: 'mascot.riv',
  artboard: 'lyla animation',
  stateMachine: null,
  tracks: {
    'blink-idle': 'blink_IDLE',
    'hands-on-hips': 'hands on hips',
    'happy-shrug': 'blink 2',
    'sheepish-wave': 'blink 3',
    'flat-shrug': 'blink 4',
    thoughtful: 'thoughtful',
    'wink-wave': 'wave',
    'arm-swing': 'testing',
    'subtle-shift': 'Timeline 2',
    'wave-once': 'wave Non Looping',
    sway: 'back and forth',
    celebration: 'celebration',
    'hair.pink': 'hair Pink',
    'hair.orange': 'hair Orange',
    'hair.brown': 'hair Brown',
    'outfit.green': 'clothing green',
    'outfit.black': 'clothing black',
    'outfit.light-green': 'clothing light green',
    'glasses.blue': 'glasses blue',
    'glasses.white': 'glasses white',
    'glasses.grey': 'glasses grey',
  },
  motionTracks: ['blink-idle', 'sway', 'subtle-shift', 'arm-swing'],
  rest: [{ track: 'wave-once', at: 0 }],
  idleLoop: { track: 'blink-idle', seconds: 2 },
  aspect: 0.8,
  locomotion: { mode: 'procedural' },
  expressions: {
    content: {
      composed: true,
      tracks: [{ track: 'happy-shrug', at: 0.08, mix: 0.55 }],
      transform: { y: -2 },
      variants: { strong: { tracks: [{ track: 'arm-swing', loop: 2.4, mix: 0.6 }] } },
    },
    amused: {
      composed: true,
      tracks: [{ track: 'happy-shrug', at: 0.1, mix: 0.9 }],
      oscillate: { property: 'y', amplitude: 2.5, hz: 4.5 },
    },
    excited: {
      composed: true,
      tracks: [{ track: 'arm-swing', loop: 1.6, mix: 0.9 }],
      oscillate: { property: 'y', amplitude: 4, hz: 2.4 },
      variants: {
        strong: { tracks: [{ track: 'celebration', at: 0.3, mix: 0.7 }], transform: { y: -6 } },
      },
    },
    proud: {
      composed: true,
      tracks: [{ track: 'celebration', at: 0.12, mix: 0.7 }],
      transform: { y: -4, scale: 1.03 },
    },
    impressed: {
      composed: true,
      tracks: [{ track: 'happy-shrug', at: 0.12, mix: 0.45 }],
      transform: { rotation: -1.5, scale: 1.02 },
    },
    smug: {
      composed: true,
      tracks: [{ track: 'hands-on-hips', at: 0.3, mix: 0.75 }],
      transform: { rotation: 2, y: -2 },
    },
    teasing: {
      composed: true,
      tracks: [{ track: 'wink-wave', at: 0.08, mix: 0.9 }],
      transform: { rotation: -2 },
    },
    skeptical: {
      composed: true,
      tracks: [
        { track: 'thoughtful', at: 0.6, mix: 0.9 },
        { track: 'hands-on-hips', at: 0.55, mix: 0.45 },
      ],
      transform: { rotation: 2.2, x: 5 },
      variants: {
        subtle: {
          tracks: [{ track: 'thoughtful', at: 0.6, mix: 0.6 }],
          transform: { rotation: 1.2 },
        },
      },
    },
    confused: {
      composed: true,
      tracks: [{ track: 'thoughtful', at: 0.3, mix: 0.8 }],
      transform: { rotation: -5 },
    },
    thinking: {
      composed: true,
      tracks: [{ track: 'thoughtful', play: { from: 0.25, to: 0.55 }, mix: 0.9 }],
      anticipation: 0.45,
    },
    sympathetic: {
      composed: true,
      tracks: [{ track: 'flat-shrug', at: 0.5, mix: 0.5 }],
      transform: { y: 3, rotation: -2 },
    },
    embarrassed: {
      composed: true,
      tracks: [{ track: 'sheepish-wave', at: 0.3, mix: 0.8 }],
      transform: { x: -6 },
    },
    innocent: {
      composed: true,
      tracks: [{ track: 'sheepish-wave', at: 0.65, mix: 0.9 }],
      transform: { x: -16, rotation: -4 },
    },
    bored: {
      composed: true,
      tracks: [{ track: 'sway', loop: 4, mix: 0.6 }],
      transform: { y: 2 },
    },
    startled: {
      composed: true,
      tracks: [{ track: 'celebration', at: 0.08, mix: 0.45 }],
      transform: { y: -14, scale: 1.04 },
      anticipation: 0.08,
      recovery: 0.6,
    },
    wave: {
      tracks: [{ track: 'wave-once', play: { from: 0, to: 1 }, mix: 0.95 }],
      anticipation: 0.15,
      variants: {
        strong: { tracks: [{ track: 'wink-wave', play: { from: 0.15, to: 0.95 }, mix: 0.95 }] },
      },
    },
    celebrate: {
      tracks: [{ track: 'celebration', play: { from: 0, to: 1 }, mix: 0.95 }],
      anticipation: 0.2,
    },
    agreeing: {
      composed: true,
      tracks: [{ track: 'happy-shrug', at: 0.25, mix: 0.35 }],
      oscillate: { property: 'y', amplitude: 4, hz: 2.2 },
    },
    disagreeing: {
      composed: true,
      tracks: [{ track: 'sway', play: { from: 0.15, to: 0.85 }, mix: 0.8 }],
      oscillate: { property: 'rotation', amplitude: 2, hz: 1.4 },
    },
    shrug: {
      composed: true,
      tracks: [{ track: 'flat-shrug', at: 0.5, mix: 0.9 }],
    },
    sassy: {
      tracks: [{ track: 'hands-on-hips', at: 0.5, mix: 0.9 }],
    },
    listening: {
      composed: true,
      tracks: [{ track: 'sheepish-wave', at: 0.15, mix: 0.4 }],
      transform: { scale: 1.025, rotation: 1.5 },
    },
    glance: { composed: true, tracks: [], transform: { rotation: 1.5, x: 2 }, anticipation: 0.15 },
    'look-away': {
      composed: true,
      tracks: [{ track: 'flat-shrug', at: 0.3, mix: 0.3 }],
      transform: { rotation: -4, x: -6 },
    },
    peek: { composed: true, tracks: [], presence: { peek: 1 } },
    'idle-glance': { composed: true, tracks: [], transform: { rotation: 1.2 }, anticipation: 0.5 },
    'idle-fidget': {
      composed: true,
      tracks: [{ track: 'subtle-shift', at: 0.5, mix: 0.5 }],
      anticipation: 0.6,
      recovery: 0.8,
    },
  },
  // No pointing pose in this rig: look toward the target instead of pretending to point.
  fallbacks: { point: 'glance' },
  attention: {
    streamer: { rotation: 3, x: 6 },
    chat: { rotation: 3, x: 6 },
    pointer: { rotation: 2.5, x: 5 },
  },
  controls: {
    tuck: {
      tracks: [{ track: 'thoughtful', at: 0.5, mix: 0.65 }],
      transform: { rotation: 3 },
      presence: { tuck: 1 },
    },
  },
  appearance: {
    hair: {
      label: 'Hair color',
      default: 'pink',
      options: [
        { id: 'pink', label: 'Pink', track: 'hair.pink' },
        { id: 'orange', label: 'Blonde', track: 'hair.orange' },
        { id: 'brown', label: 'Brown', track: 'hair.brown' },
      ],
    },
    outfit: {
      label: 'Outfit color',
      default: 'green',
      options: [
        { id: 'green', label: 'Green', track: 'outfit.green' },
        { id: 'black', label: 'Black', track: 'outfit.black' },
        { id: 'light-green', label: 'Light green', track: 'outfit.light-green' },
      ],
    },
    glasses: {
      label: 'Glasses color',
      default: 'blue',
      options: [
        { id: 'blue', label: 'Blue', track: 'glasses.blue' },
        { id: 'white', label: 'White', track: 'glasses.white' },
        { id: 'grey', label: 'Grey', track: 'glasses.grey' },
      ],
    },
  },
};
