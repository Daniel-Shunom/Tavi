import type { HolidayId } from './calendar';

// Her room, dressed for each holiday. The stage becomes a room: a wall and a floor, things at the
// back, things hanging from the ceiling, and props at the front near the viewer, which is what
// gives it depth. Pictures are Fluent Emoji (see art/CREDITS.md). Kept free of React and assets so
// tests can check every room.
//
// Positions are percentages of the 16:9 stage. `x` is the prop's centre. For standing props `y`
// is where its base sits, measured from the top (the floor starts at 75). Hanging props give
// `hang`, the length of their thread from the ceiling, instead. `size` is the width.

export type RoomProp = {
  art: string;
  x: number;
  size: number;
  /** back: behind her. front: in front of her. ceiling: hanging on a thread, behind her. */
  layer: 'back' | 'front' | 'ceiling';
  y?: number;
  hang?: number;
  /** Glows while she is here (lanterns, candles, stars). */
  glow?: boolean;
  /** How it joins in while she reacts. */
  move?: 'twinkle' | 'bob' | 'flutter' | 'flicker';
  flip?: boolean;
  tilt?: number;
  /** Shown inside a window frame on the wall. */
  window?: boolean;
};

export type Room = {
  /** The reaction key this holiday adds, and which quick reaction it cues (see parts.tsx). */
  key: { label: string; cue: number };
  props: readonly RoomProp[];
};

export const rooms: Record<HolidayId, Room> = {
  newyear: {
    key: { label: 'Party', cue: 1 },
    props: [
      { art: 'fireworks', x: 11, y: 46, size: 13, layer: 'back', window: true, glow: true },
      { art: 'mantelpiece-clock', x: 87, y: 83, size: 11, layer: 'back' },
      {
        art: 'mirror-ball',
        x: 50,
        hang: 5,
        size: 9,
        layer: 'ceiling',
        glow: true,
        move: 'twinkle',
      },
      { art: 'sparkles', x: 29, hang: 12, size: 6, layer: 'ceiling', glow: true, move: 'twinkle' },
      { art: 'sparkles', x: 72, hang: 15, size: 5, layer: 'ceiling', glow: true, move: 'twinkle' },
      { art: 'balloon', x: 20, y: 70, size: 8, layer: 'back', move: 'bob' },
      { art: 'balloon', x: 78, y: 64, size: 7, layer: 'back', move: 'bob', flip: true },
      { art: 'party-popper', x: 8, y: 99, size: 13, layer: 'front' },
      { art: 'confetti-ball', x: 93, y: 99, size: 11, layer: 'front' },
    ],
  },
  lunar: {
    key: { label: 'Good fortune', cue: 1 },
    props: [
      { art: 'dragon', x: 13, y: 62, size: 18, layer: 'back' },
      { art: 'folding-hand-fan', x: 89, y: 52, size: 11, layer: 'back' },
      {
        art: 'red-paper-lantern',
        x: 27,
        hang: 3,
        size: 8,
        layer: 'ceiling',
        glow: true,
        move: 'bob',
      },
      {
        art: 'red-paper-lantern',
        x: 50,
        hang: 9,
        size: 9,
        layer: 'ceiling',
        glow: true,
        move: 'bob',
      },
      {
        art: 'red-paper-lantern',
        x: 73,
        hang: 3,
        size: 8,
        layer: 'ceiling',
        glow: true,
        move: 'bob',
      },
      { art: 'red-envelope', x: 8, y: 99, size: 9, layer: 'front', tilt: -8 },
      { art: 'tangerine', x: 17, y: 100, size: 6, layer: 'front' },
      { art: 'tangerine', x: 22, y: 100, size: 5, layer: 'front', flip: true },
      { art: 'firecracker', x: 93, y: 99, size: 9, layer: 'front' },
      { art: 'moon-cake', x: 84, y: 100, size: 6, layer: 'front' },
    ],
  },
  valentines: {
    key: { label: 'Send a heart', cue: 0 },
    props: [
      { art: 'teddy-bear', x: 10, y: 86, size: 13, layer: 'back' },
      { art: 'bouquet', x: 90, y: 85, size: 12, layer: 'back' },
      { art: 'red-heart', x: 22, hang: 5, size: 6, layer: 'ceiling', move: 'bob' },
      {
        art: 'sparkling-heart',
        x: 41,
        hang: 12,
        size: 6,
        layer: 'ceiling',
        glow: true,
        move: 'twinkle',
      },
      { art: 'heart-with-ribbon', x: 61, hang: 4, size: 7, layer: 'ceiling', move: 'bob' },
      { art: 'red-heart', x: 79, hang: 11, size: 5, layer: 'ceiling', move: 'bob' },
      { art: 'balloon', x: 5, y: 62, size: 8, layer: 'back', move: 'bob' },
      { art: 'love-letter', x: 21, y: 99, size: 9, layer: 'front', tilt: -8 },
      { art: 'rose', x: 95, y: 100, size: 9, layer: 'front' },
      { art: 'candy', x: 86, y: 100, size: 5, layer: 'front' },
    ],
  },
  stpatricks: {
    key: { label: 'Lucky', cue: 1 },
    props: [
      { art: 'rainbow', x: 14, y: 58, size: 22, layer: 'back' },
      { art: 'top-hat', x: 87, y: 84, size: 10, layer: 'back' },
      { art: 'money-bag', x: 77, y: 86, size: 9, layer: 'back' },
      { art: 'shamrock', x: 28, hang: 5, size: 6, layer: 'ceiling', move: 'bob' },
      { art: 'four-leaf-clover', x: 50, hang: 12, size: 6, layer: 'ceiling', move: 'bob' },
      { art: 'shamrock', x: 72, hang: 4, size: 5.5, layer: 'ceiling', move: 'bob' },
      { art: 'coin', x: 9, y: 96, size: 6, layer: 'front', glow: true, move: 'twinkle' },
      { art: 'coin', x: 5, y: 100, size: 6, layer: 'front', glow: true, move: 'twinkle' },
      { art: 'coin', x: 14, y: 100, size: 5, layer: 'front', glow: true, move: 'twinkle' },
      { art: 'four-leaf-clover', x: 93, y: 100, size: 9, layer: 'front' },
    ],
  },
  easter: {
    key: { label: 'Egg hunt', cue: 7 },
    props: [
      { art: 'cherry-blossom', x: 92, y: 30, size: 8, layer: 'back' },
      { art: 'tulip', x: 8, y: 85, size: 9, layer: 'back' },
      { art: 'tulip', x: 15, y: 86, size: 8, layer: 'back', flip: true },
      { art: 'rabbit', x: 86, y: 86, size: 12, layer: 'back' },
      { art: 'butterfly', x: 30, hang: 10, size: 6, layer: 'ceiling', move: 'flutter' },
      { art: 'cherry-blossom', x: 49, hang: 4, size: 5, layer: 'ceiling', move: 'bob' },
      { art: 'butterfly', x: 66, hang: 17, size: 5, layer: 'ceiling', move: 'flutter' },
      { art: 'basket', x: 9, y: 99, size: 13, layer: 'front' },
      { art: 'egg', x: 19, y: 100, size: 6, layer: 'front' },
      { art: 'egg', x: 2, y: 100, size: 5, layer: 'front', tilt: 14 },
      { art: 'hatching-chick', x: 92, y: 100, size: 10, layer: 'front', move: 'bob' },
    ],
  },
  halloween: {
    key: { label: 'Boo', cue: 7 },
    props: [
      { art: 'full-moon', x: 11, y: 44, size: 10, layer: 'back', window: true, glow: true },
      { art: 'spider-web', x: 94, y: 26, size: 14, layer: 'back' },
      { art: 'ghost', x: 70, y: 58, size: 9, layer: 'back', move: 'bob' },
      { art: 'black-cat', x: 82, y: 85, size: 10, layer: 'back' },
      { art: 'bat', x: 30, hang: 5, size: 9, layer: 'ceiling', move: 'flutter' },
      { art: 'spider', x: 47, hang: 20, size: 6, layer: 'ceiling', move: 'bob' },
      { art: 'bat', x: 60, hang: 11, size: 7, layer: 'ceiling', move: 'flutter', flip: true },
      { art: 'jack-o-lantern', x: 9, y: 98, size: 15, layer: 'front', glow: true, move: 'twinkle' },
      {
        art: 'jack-o-lantern',
        x: 20,
        y: 100,
        size: 10,
        layer: 'front',
        glow: true,
        move: 'twinkle',
        flip: true,
      },
      { art: 'jack-o-lantern', x: 2, y: 100, size: 7, layer: 'front', glow: true },
      { art: 'candle', x: 91, y: 99, size: 8, layer: 'front', glow: true, move: 'flicker' },
      { art: 'candle', x: 96, y: 100, size: 6, layer: 'front', glow: true, move: 'flicker' },
      { art: 'candy', x: 85, y: 100, size: 5, layer: 'front' },
    ],
  },
  harvest: {
    key: { label: 'Thankful', cue: 1 },
    props: [
      { art: 'sheaf-of-rice', x: 8, y: 85, size: 13, layer: 'back' },
      { art: 'mushroom', x: 87, y: 85, size: 8, layer: 'back' },
      { art: 'mushroom', x: 93, y: 86, size: 5.5, layer: 'back', flip: true },
      { art: 'maple-leaf', x: 26, hang: 7, size: 6, layer: 'ceiling', move: 'bob' },
      { art: 'fallen-leaf', x: 50, hang: 14, size: 6, layer: 'ceiling', move: 'bob' },
      { art: 'maple-leaf', x: 74, hang: 5, size: 5, layer: 'ceiling', move: 'bob', flip: true },
      { art: 'ear-of-corn', x: 8, y: 99, size: 11, layer: 'front' },
      { art: 'chestnut', x: 17, y: 100, size: 5, layer: 'front' },
      { art: 'chestnut', x: 2, y: 100, size: 4.5, layer: 'front' },
      { art: 'pie', x: 91, y: 99, size: 11, layer: 'front' },
      { art: 'red-apple', x: 81, y: 100, size: 6, layer: 'front' },
    ],
  },
  christmas: {
    key: { label: 'Festive cheer', cue: 1 },
    props: [
      { art: 'christmas-tree', x: 11, y: 86, size: 26, layer: 'back', glow: true },
      { art: 'deer', x: 73, y: 86, size: 11, layer: 'back' },
      { art: 'snowman', x: 60, y: 85, size: 9, layer: 'back' },
      { art: 'bell', x: 34, hang: 4, size: 6, layer: 'ceiling', move: 'bob' },
      {
        art: 'glowing-star',
        x: 50,
        hang: 10,
        size: 6,
        layer: 'ceiling',
        glow: true,
        move: 'twinkle',
      },
      { art: 'snowflake', x: 66, hang: 5, size: 5, layer: 'ceiling', move: 'twinkle' },
      { art: 'wrapped-gift', x: 24, y: 92, size: 8, layer: 'back' },
      { art: 'wrapped-gift', x: 89, y: 99, size: 13, layer: 'front' },
      { art: 'wrapped-gift', x: 97, y: 100, size: 8, layer: 'front', flip: true },
      { art: 'candy', x: 80, y: 100, size: 6, layer: 'front' },
    ],
  },
};

/** What the room is doing, from what she is doing. */
export type RoomMood = 'lit' | 'dim' | 'dark';
export function roomMood(now: {
  connected: boolean;
  retracted: boolean;
  quiet: boolean;
}): RoomMood {
  if (!now.connected || now.retracted) return 'dark';
  return now.quiet ? 'dim' : 'lit';
}
