// Mascot / Avatar Customization by alisketch (CC BY 4.0), artboard "lyla animation".
// Grounded in tools/rive-inventory.mjs and tools/rive-clip-sampler.mjs (see README.md):
// - Inactive at runtime (zero rendered change): face x/y, brow left/right, mouth X/Y,
//   mouth smile frown, blinks left/right, lower lid blinks, hair squash/swing, hairswoop,
//   squash stretch, Timeline 4. They are not bound.
// - "wave testing folio header" permanently rescales the artboard to ~65% and is excluded.
// - Every expression below is composed from verified full-body clips plus small host offsets;
//   these clips have no independently controllable brows, mouth or eyes. The face itself is driven
//   through the joysticks by the face layer (face.ts poses, src/renderer/face/).
import type { ManifestInput } from '../manifest';
import { mascotFace } from './face';
import { mascotControlTracks, mascotMotionNodes } from './motion';

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
    // Control tracks added in memory by the motion rig patch (characters/mascot/motionRig.ts):
    // the face, brows, lids, mouth, squash and hair are joystick channels in this rig.
    ...mascotControlTracks,
  },
  nodes: mascotMotionNodes,
  motionTracks: [
    'blink-idle',
    'sway',
    'subtle-shift',
    'arm-swing',
    ...Object.keys(mascotControlTracks),
  ],
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
      motion: 'skeptical',
      tracks: [
        { track: 'thoughtful', play: { from: 0.45, to: 0.7 }, pingpong: 2.4, mix: 0.9 },
        { track: 'hands-on-hips', play: { from: 0.4, to: 0.6 }, pingpong: 3.1, mix: 0.45 },
      ],
      transform: { rotation: 2.2, x: 5 },
      variants: {
        subtle: {
          tracks: [{ track: 'thoughtful', play: { from: 0.5, to: 0.65 }, pingpong: 2.4, mix: 0.6 }],
          transform: { rotation: 1.2 },
        },
      },
    },
    confused: {
      composed: true,
      tracks: [{ track: 'thoughtful', play: { from: 0.2, to: 0.4 }, pingpong: 2.2, mix: 0.8 }],
      transform: { rotation: -5 },
      oscillate: { property: 'rotation', amplitude: 1.2, hz: 0.6 },
    },
    thinking: {
      composed: true,
      tracks: [{ track: 'thoughtful', play: { from: 0.25, to: 0.55 }, mix: 0.9 }],
      anticipation: 0.45,
    },
    sympathetic: {
      composed: true,
      tracks: [{ track: 'flat-shrug', play: { from: 0.4, to: 0.6 }, pingpong: 2.8, mix: 0.5 }],
      transform: { y: 3, rotation: -2 },
    },
    embarrassed: {
      composed: true,
      tracks: [{ track: 'sheepish-wave', play: { from: 0.2, to: 0.4 }, pingpong: 1.8, mix: 0.8 }],
      transform: { x: -6 },
    },
    innocent: {
      composed: true,
      motion: 'caught',
      tracks: [{ track: 'sheepish-wave', play: { from: 0.5, to: 0.75 }, pingpong: 2, mix: 0.9 }],
      transform: { x: -16, rotation: -4 },
    },
    bored: {
      composed: true,
      tracks: [{ track: 'sway', loop: 4, mix: 0.6 }],
      transform: { y: 2 },
    },
    startled: {
      composed: true,
      tracks: [{ track: 'celebration', play: { from: 0, to: 0.12 }, mix: 0.45 }],
      transform: { y: -14, scale: 1.04 },
      oscillate: { property: 'y', amplitude: 2, hz: 3 },
      anticipation: 0.08,
      recovery: 0.6,
    },
    // Facial emotes: the face pose (face.ts) carries the emotion; these add posture and a
    // living body accent so they still read where no face layer runs.
    'soft-smile': {
      composed: true,
      tracks: [{ track: 'happy-shrug', at: 0.06, mix: 0.35 }],
      oscillate: { property: 'rotation', amplitude: 0.6, hz: 0.35 },
      transform: { rotation: 1 },
    },
    grin: {
      composed: true,
      tracks: [{ track: 'happy-shrug', at: 0.12, mix: 0.7 }],
      oscillate: { property: 'y', amplitude: 1.5, hz: 1.2 },
      transform: { y: -3, scale: 1.02 },
    },
    laugh: {
      composed: true,
      tracks: [{ track: 'happy-shrug', play: { from: 0.1, to: 0.2 }, pingpong: 0.45, mix: 0.8 }],
      oscillate: { property: 'y', amplitude: 3, hz: 5 },
      transform: { rotation: -2 },
      anticipation: 0.12,
    },
    smirk: {
      composed: true,
      tracks: [{ track: 'hands-on-hips', at: 0.2, mix: 0.35 }],
      oscillate: { property: 'rotation', amplitude: 0.5, hz: 0.4 },
      transform: { rotation: 2.5 },
    },
    'eye-roll': {
      composed: true,
      tracks: [{ track: 'flat-shrug', play: { from: 0.3, to: 0.5 }, pingpong: 1.6, mix: 0.5 }],
      transform: { rotation: -1.5, y: 1 },
    },
    suspicious: {
      composed: true,
      tracks: [{ track: 'thoughtful', play: { from: 0.4, to: 0.55 }, pingpong: 3, mix: 0.5 }],
      transform: { rotation: 3, x: 4 },
      oscillate: { property: 'x', amplitude: 1.5, hz: 0.25 },
    },
    deadpan: {
      composed: true,
      tracks: [],
      transform: { y: 1 },
      oscillate: { property: 'scale', amplitude: 0.003, hz: 0.25 },
    },
    focused: {
      composed: true,
      tracks: [],
      transform: { scale: 1.02, y: 2 },
      oscillate: { property: 'rotation', amplitude: 0.4, hz: 0.3 },
    },
    determined: {
      composed: true,
      tracks: [{ track: 'hands-on-hips', play: { from: 0.4, to: 0.6 }, pingpong: 2.4, mix: 0.6 }],
      transform: { y: -2, scale: 1.02 },
    },
    frown: {
      composed: true,
      tracks: [{ track: 'flat-shrug', at: 0.2, mix: 0.3 }],
      transform: { y: 2 },
      oscillate: { property: 'rotation', amplitude: 0.5, hz: 0.3 },
    },
    pout: {
      composed: true,
      tracks: [{ track: 'sheepish-wave', play: { from: 0.2, to: 0.3 }, pingpong: 2.2, mix: 0.35 }],
      transform: { rotation: -3, x: -4 },
    },
    annoyed: {
      composed: true,
      tracks: [{ track: 'hands-on-hips', play: { from: 0.35, to: 0.55 }, pingpong: 2.8, mix: 0.7 }],
      transform: { rotation: 1.5 },
    },
    sad: {
      composed: true,
      tracks: [{ track: 'flat-shrug', play: { from: 0.45, to: 0.55 }, pingpong: 3.2, mix: 0.35 }],
      transform: { y: 5, rotation: 2, scale: 0.99 },
    },
    worried: {
      composed: true,
      tracks: [{ track: 'sheepish-wave', at: 0.2, mix: 0.3 }],
      transform: { scale: 0.99, y: 2 },
      oscillate: { property: 'x', amplitude: 1.5, hz: 1.1 },
    },
    wince: {
      composed: true,
      tracks: [],
      transform: { x: -6, rotation: -3, scale: 0.98 },
      oscillate: { property: 'x', amplitude: 1, hz: 4 },
      anticipation: 0.06,
      recovery: 0.5,
    },
    'grossed-out': {
      composed: true,
      tracks: [{ track: 'flat-shrug', at: 0.3, mix: 0.4 }],
      transform: { x: -10, rotation: -4 },
      oscillate: { property: 'rotation', amplitude: 1, hz: 2.2 },
      anticipation: 0.1,
    },
    shocked: {
      composed: true,
      tracks: [{ track: 'celebration', play: { from: 0, to: 0.1 }, mix: 0.35 }],
      transform: { y: -8, scale: 1.03 },
      oscillate: { property: 'scale', amplitude: 0.004, hz: 6 },
      anticipation: 0.08,
    },
    sleepy: {
      composed: true,
      tracks: [{ track: 'sway', loop: 6, mix: 0.4 }],
      transform: { y: 4, rotation: 3 },
      anticipation: 0.6,
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
      motion: 'nod',
      tracks: [{ track: 'happy-shrug', play: { from: 0.2, to: 0.3 }, pingpong: 0.9, mix: 0.35 }],
      oscillate: { property: 'y', amplitude: 4, hz: 2.2 },
      transform: { rotation: 1 },
    },
    disagreeing: {
      composed: true,
      tracks: [{ track: 'sway', play: { from: 0.15, to: 0.85 }, mix: 0.8 }],
      oscillate: { property: 'rotation', amplitude: 2, hz: 1.4 },
    },
    shrug: {
      composed: true,
      tracks: [{ track: 'flat-shrug', play: { from: 0.35, to: 0.6 }, pingpong: 2.2, mix: 0.9 }],
    },
    sassy: {
      tracks: [{ track: 'hands-on-hips', play: { from: 0.35, to: 0.65 }, pingpong: 2.6, mix: 0.9 }],
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
  face: mascotFace,
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
