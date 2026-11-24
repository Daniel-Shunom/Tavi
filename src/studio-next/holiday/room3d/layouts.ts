import type { HolidayId } from '../calendar';

// What stands where in each 3D holiday room. Kept free of three.js so the rest of Studio can ask
// which holidays have a 3D room without loading it. Models are CC0 packs served from
// `public/rooms/`; see `public/credits/holiday-rooms.md`.
//
// Units: the floor runs x −10…10 across and z −5 (back wall) … 4 (nearest). She stands around
// z 0, so anything marked `front` draws in front of her.

export type Lamp = {
  colour: number;
  power: number;
  /** Where the light sits inside the thing, from its base. */
  y?: number;
  z?: number;
};

export type Item = {
  /** Path under `public/rooms/`. */
  model: string;
  x: number;
  z: number;
  /** Height of its base above the floor. */
  y?: number;
  /** Size it to this height, or to this width when `w` is given instead. */
  h?: number;
  w?: number;
  turn?: number;
  /** Draws in front of her. */
  front?: boolean;
  /** A light inside it. A click switches it on and off. */
  lamp?: Lamp;
  /** Makes its own colours glow (string lights, a lantern's glass). A click switches it. */
  glow?: number;
  /** Starts switched off. */
  off?: boolean;
  /** Answers a click with a hop even though it has no light. */
  toy?: boolean;
  /** Hangs, so it swings instead of hopping. */
  hangs?: boolean;
};

export type Layout = {
  /** Colours blended with the theme's own so each room keeps its theme. */
  wall: string;
  floor: string;
  trim: string;
  rail: string;
  sky: number;
  ground: number;
  sun: number;
  fill: number;
  items: Item[];
};

const HB = 'kaykit-halloween/';
const FB = 'kaykit-furniture/';
const KH = 'kenney-holiday/';
const ORANGE = 0xff8a1f;
const CANDLE = 0xffc56b;
const WARM = 0xffd9a0;

const halloween: Layout = {
  wall: '#5a4585',
  floor: '#4a3226',
  trim: '#2a1d3d',
  rail: '#5a4470',
  sky: 0xa99fe0,
  ground: 0x2a1c3a,
  sun: 0xbfd0ff,
  fill: 0xffc9a0,
  items: [
    { model: FB + 'rug_oval_A.gltf', w: 8.4, x: 0, y: 0.02, z: 0.5 },
    // Back wall.
    { model: FB + 'cabinet_medium_decorated.gltf', h: 2.5, x: -6.6, z: -4.1 },
    { model: FB + 'shelf_B_small_decorated.gltf', w: 3, x: -6.4, y: 4.7, z: -4.7 },
    { model: FB + 'table_small.gltf', h: 1.3, x: -2.8, z: -4 },
    {
      model: HB + 'candle_triple.gltf',
      h: 0.95,
      x: -2.8,
      y: 1.3,
      z: -4,
      lamp: { colour: CANDLE, power: 7, y: 1 },
    },
    {
      model: HB + 'lantern_hanging.gltf',
      h: 1.5,
      x: -2.8,
      y: 5.4,
      z: -4.6,
      hangs: true,
      glow: 0.9,
      lamp: { colour: 0xffb347, power: 6, y: 0.5, z: 0.4 },
    },
    { model: FB + 'pictureframe_large_A.gltf', h: 1.7, x: 1, y: 4.3, z: -4.9 },
    { model: FB + 'pictureframe_small_B.gltf', h: 0.9, x: 3.2, y: 5, z: -4.9 },
    { model: HB + 'coffin_decorated.gltf', w: 3.6, x: 2.2, z: -3.8, turn: 0.15, toy: true },
    {
      model: HB + 'skull_candle.gltf',
      h: 0.85,
      x: 4.1,
      z: -2.2,
      turn: -0.4,
      lamp: { colour: CANDLE, power: 4, y: 0.9 },
    },
    { model: FB + 'armchair_pillows.gltf', h: 2.2, x: 6.1, z: -2.8, turn: -0.5 },
    {
      model: FB + 'lamp_standing.gltf',
      h: 3.8,
      x: 8.4,
      z: -3.9,
      lamp: { colour: WARM, power: 14, y: 3.2, z: 0.3 },
    },
    { model: HB + 'post_skull.gltf', h: 2.8, x: -8.9, z: -2.2, turn: 0.5, toy: true },
    // The pumpkin pile at the back of the floor.
    {
      model: HB + 'pumpkin_orange_jackolantern.gltf',
      h: 1.7,
      x: -5.3,
      z: -1.2,
      turn: 0.35,
      lamp: { colour: ORANGE, power: 14, y: 0.8, z: 0.9 },
    },
    { model: HB + 'pumpkin_orange.gltf', h: 1.25, x: -7.2, z: -0.4, turn: 1, toy: true },
    {
      model: HB + 'pumpkin_yellow_jackolantern.gltf',
      h: 1.05,
      x: -4,
      z: 0.2,
      turn: 0.2,
      lamp: { colour: 0xffb347, power: 7, y: 0.5, z: 0.6 },
    },
    // The foreground, in front of her.
    {
      model: HB + 'pumpkin_orange_jackolantern.gltf',
      h: 2,
      x: -5.2,
      z: 3.3,
      turn: 0.3,
      front: true,
      lamp: { colour: ORANGE, power: 14, y: 0.9, z: 1 },
    },
    { model: HB + 'pumpkin_yellow_small.gltf', h: 0.7, x: -3.4, z: 3.8, front: true, toy: true },
    {
      model: HB + 'lantern_standing.gltf',
      h: 1.4,
      x: -6.4,
      z: 2.4,
      turn: 0.4,
      front: true,
      glow: 0.9,
      lamp: { colour: 0xa3e36a, power: 6, y: 0.7 },
    },
    {
      model: HB + 'pumpkin_orange_jackolantern.gltf',
      h: 1.4,
      x: 5.2,
      z: 3.3,
      turn: -0.4,
      front: true,
      lamp: { colour: ORANGE, power: 10, y: 0.7, z: 0.8 },
    },
    {
      model: HB + 'pumpkin_yellow.gltf',
      h: 0.95,
      x: 6.5,
      z: 2.7,
      turn: 0.7,
      front: true,
      toy: true,
    },
    {
      model: HB + 'candle_melted.gltf',
      h: 0.75,
      x: 3.8,
      z: 3.7,
      front: true,
      lamp: { colour: CANDLE, power: 4, y: 0.9 },
    },
    {
      model: HB + 'candle_thin.gltf',
      h: 1,
      x: 6.3,
      z: 3.8,
      front: true,
      lamp: { colour: CANDLE, power: 4, y: 1.1 },
    },
    { model: HB + 'bone_A.gltf', w: 0.9, x: 2.7, y: 0.02, z: 3.9, turn: 0.8, front: true },
  ],
};

const christmas: Layout = {
  wall: '#2f5548',
  floor: '#7a5236',
  trim: '#e9dcc6',
  rail: '#c9b79a',
  sky: 0xfff1dc,
  ground: 0x4a3020,
  sun: 0xffe2bd,
  fill: 0xffd9b0,
  items: [
    { model: FB + 'rug_rectangle_stripes_A.gltf', w: 8.4, x: 0.2, y: 0.02, z: 0.6 },
    // String lights along the top of the back wall.
    ...[-3, -2, -1, 0, 1, 2, 3].map((i): Item => ({
      model: KH + 'lights-colored.glb',
      w: 3.1,
      x: i * 3.1,
      y: 8.5,
      z: -4.85,
      glow: 1.4,
    })),
    { model: KH + 'snowflake-a.glb', h: 0.8, x: -2, y: 6.2, z: -4.9 },
    { model: KH + 'snowflake-b.glb', h: 0.65, x: 3.1, y: 6.9, z: -4.9 },
    { model: KH + 'wreath-decorated.glb', h: 1.9, x: 0.8, y: 3.9, z: -4.8, hangs: true },
    { model: KH + 'sock-red-cane.glb', h: 1.15, x: 4, y: 3.8, z: -4.8, hangs: true },
    { model: KH + 'sock-green.glb', h: 1.15, x: 5.3, y: 3.8, z: -4.8, hangs: true },
    { model: KH + 'sock-red.glb', h: 1.15, x: 6.6, y: 3.8, z: -4.8, hangs: true },
    // The tree and what is under it.
    {
      model: KH + 'tree-decorated.glb',
      h: 5.8,
      x: -6.2,
      z: -2.5,
      toy: true,
      lamp: { colour: 0xffd27a, power: 16, y: 2.4, z: 1.8 },
    },
    { model: KH + 'present-a-cube.glb', h: 1, x: -4, z: -0.9, turn: 0.4, toy: true },
    { model: KH + 'present-a-round.glb', h: 0.9, x: -7.9, z: -0.2, toy: true },
    { model: KH + 'present-b-rectangle.glb', h: 0.7, x: -5.4, z: 0.3, turn: -0.3, toy: true },
    { model: KH + 'nutcracker.glb', h: 2.5, x: -2.2, z: -3.9, turn: 0.2, toy: true },
    // Somewhere to sit.
    { model: FB + 'table_low.gltf', h: 0.8, x: 0.9, z: -3.7 },
    { model: KH + 'gingerbread-man.glb', h: 0.8, x: 0.3, y: 0.8, z: -3.7, turn: 0.2, toy: true },
    {
      model: KH + 'lantern.glb',
      h: 0.85,
      x: 1.7,
      y: 0.8,
      z: -3.7,
      glow: 0.8,
      lamp: { colour: 0xffb347, power: 5, y: 0.6 },
    },
    { model: FB + 'couch_pillows.gltf', h: 2.05, x: 5.4, z: -3.4, turn: -0.12 },
    {
      model: FB + 'lamp_standing.gltf',
      h: 3.8,
      x: 8.7,
      z: -3.9,
      lamp: { colour: WARM, power: 14, y: 3.2, z: 0.3 },
    },
    { model: KH + 'reindeer.glb', h: 1.8, x: 7.2, z: 0.2, turn: -0.7, toy: true },
    // The foreground, in front of her.
    {
      model: KH + 'present-b-cube.glb',
      h: 1.1,
      x: -5.6,
      z: 3.3,
      turn: 0.5,
      front: true,
      toy: true,
    },
    { model: KH + 'present-b-round.glb', h: 0.75, x: -4, z: 3.8, front: true, toy: true },
    {
      model: KH + 'candy-cane-red.glb',
      h: 1.6,
      x: -6.6,
      z: 2.6,
      turn: 0.3,
      front: true,
      toy: true,
    },
    { model: KH + 'train-locomotive.glb', w: 1.7, x: 3.2, z: 3.5, front: true, toy: true },
    { model: KH + 'train-tender.glb', w: 1.35, x: 4.75, z: 3.5, front: true, toy: true },
    { model: KH + 'train-wagon-logs.glb', w: 1.55, x: 6.2, z: 3.5, front: true, toy: true },
  ],
};

export const layouts: Partial<Record<HolidayId, Layout>> = { halloween, christmas };

export function has3dRoom(id: HolidayId) {
  return id in layouts;
}

/** Every model file the rooms use, for the copy script and the tests. */
export function modelsInUse() {
  return [
    ...new Set(Object.values(layouts).flatMap((layout) => layout.items.map((item) => item.model))),
  ].sort();
}
