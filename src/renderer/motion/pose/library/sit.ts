// Held sitting postures (POSING-AND-STAGING.md section 3, "Sitting"), each a hold beat whose last
// key is the held pose and whose life keeps it breathing with the hands planted on the seat.
// Floor beats: floor at y 0 (the seat and soles on it). Ledge beats: the ledge at y 0 with the
// seat on it (lift = -seat height), the legs hanging in front of the frame.
import { defineBeat, type Life } from '../schema';

const OPEN = 1;
const FIST = 2;
/** Seat above the soles while seated on an edge (mascot states.ts seatHeight). */
const SEAT = 105 / 600;
/** Knuckle height of a hand resting on a surface (proxy handRadius). */
const HAND = 0.045;

const floorSurfaces = [{ id: 'floor', kind: 'floor' as const, at: 0, from: -0.6, to: 0.6 }];
const ledgeSurfaces = [
  { id: 'ledge', kind: 'ledge' as const, at: 0, from: -0.4, to: 0.4 },
  { id: 'floor', kind: 'floor' as const, at: -0.9, from: -0.6, to: 0.6 },
];
// Cross-legged: the feet tuck in front of the seat, so the seat is the only leg contact.
const floorSit = [{ part: 'seat' as const, surface: 'floor' }];
const ledgeSeat = { part: 'seat' as const, surface: 'ledge' };

/** Breath and slow weight drift; hands stay planted (the sampler re-solves them). */
const seatedLife = (period: number): Life[] => [
  { channel: 'squash', amplitude: 0.07, period, shape: 'sine', phase: 0 },
  { channel: 'lean', amplitude: 0.025, period: 9.3, shape: 'noise', phase: 0 },
  { channel: 'headTilt', amplitude: 0.035, period: 7.1, shape: 'noise', phase: 0 },
  { channel: 'gazeX', amplitude: 0.25, period: 5.3, shape: 'noise', phase: 0 },
];

/** Floor, upright and cross-legged: hands planted on the floor beside the knees, head level. */
export const sitFloorUpright = defineBeat({
  id: 'sit-floor-upright',
  label: 'Sit on the floor: upright',
  use: 'hold',
  surfaces: floorSurfaces,
  keys: [
    {
      name: 'upright',
      at: 0,
      pose: {
        bob: 106 / 600,
        footLX: 0.04,
        footRX: -0.02,
        footLY: 0.03,
        footRY: 0.03,
        squash: 0.4,
        headTilt: 0.04,
        handL: OPEN,
        handR: OPEN,
        smile: 0.15,
      },
      reach: { L: { at: { x: -0.145, y: HAND } }, R: { at: { x: 0.175, y: HAND } } },
      contacts: [
        ...floorSit,
        { part: 'handL', surface: 'floor' },
        { part: 'handR', surface: 'floor' },
      ],
    },
  ],
  life: seatedLife(4.2),
});

/** Floor, relaxed slouch: slumped onto the propped left arm, a lazy C, the other hand in the lap. */
export const sitFloorSlouch = defineBeat({
  id: 'sit-floor-slouch',
  label: 'Sit on the floor: relaxed slouch',
  use: 'hold',
  surfaces: floorSurfaces,
  keys: [
    {
      name: 'slouch',
      at: 0,
      pose: {
        bob: 106 / 600,
        shift: -0.012,
        lean: -0.12,
        headTilt: -0.1,
        headY: 0.008,
        footLX: 0.03,
        footRX: -0.01,
        footLY: 0.02,
        footRY: 0.04,
        squash: 0.55,
        armR: -0.15,
        elbowR: -0.9,
        handL: OPEN,
        squintL: 0.25,
        squintR: 0.25,
        smile: 0.2,
        mouthX: -0.2,
      },
      reach: { L: { at: { x: -0.165, y: HAND } } },
      contacts: [...floorSit, { part: 'handL', surface: 'floor' }],
    },
  ],
  life: seatedLife(4.6),
});

/** Ledge, upright: hands gripping the edge beside the hips, legs hanging (the player swings them). */
export const sitLedgeUpright = defineBeat({
  id: 'sit-ledge-upright',
  label: 'Sit on a ledge: upright, hands on the edge',
  use: 'hold',
  frame: 'ledge',
  surfaces: ledgeSurfaces,
  keys: [
    {
      name: 'upright',
      at: 0,
      place: { lift: -SEAT },
      pose: {
        bob: 10 / 600,
        footLX: -0.02,
        footRX: 0.015,
        footLY: 0.03,
        footRY: 0.03,
        handL: FIST,
        handR: FIST,
        headTilt: 0.03,
        smile: 0.15,
      },
      reach: { L: { at: { x: -0.13, y: HAND } }, R: { at: { x: 0.155, y: HAND } } },
      contacts: [
        ledgeSeat,
        { part: 'handL', surface: 'ledge' },
        { part: 'handR', surface: 'ledge' },
      ],
    },
  ],
  life: seatedLife(4.2),
});

/** Ledge, slouch: leaning onto the propped right arm, the left hand on the thigh, head tipped. */
export const sitLedgeSlouch = defineBeat({
  id: 'sit-ledge-slouch',
  label: 'Sit on a ledge: relaxed slouch',
  use: 'hold',
  frame: 'ledge',
  surfaces: ledgeSurfaces,
  keys: [
    {
      name: 'slouch',
      at: 0,
      place: { lift: -SEAT },
      pose: {
        bob: 12 / 600,
        shift: 0.012,
        lean: 0.11,
        headTilt: 0.13,
        headY: 0.006,
        footLX: -0.03,
        footRX: 0.02,
        footLY: 0.045,
        footRY: 0.02,
        armL: -0.1,
        elbowL: 0.7,
        handR: OPEN,
        squash: 0.3,
        squintL: 0.3,
        squintR: 0.3,
        smile: 0.25,
        mouthX: 0.2,
      },
      reach: { R: { at: { x: 0.19, y: HAND } } },
      contacts: [ledgeSeat, { part: 'handR', surface: 'ledge' }],
    },
  ],
  life: seatedLife(4.6),
});
