// Dusting off the knees after the drop's splat (POSING-AND-STAGING.md section 3): bend at the hips
// and knees with a look down, open hands patting the knees in alternation (elbows bent, hands
// staged beside the legs, not across the body), a little "hmph", then a look up. Starts from the
// drop's get-up pose and ends near standing for the straighten beat.
import { defineBeat, type KeyInput } from '../schema';

const OPEN = 1;
const floor = 'floor';
const soles = [
  { part: 'soleL' as const, surface: floor },
  { part: 'soleR' as const, surface: floor },
];
/** Crouched base: knees bent, head down and forward, a grumpy brow. */
const bent = {
  bob: 0.055,
  headY: 0.012,
  gazeY: 0.85,
  pupilY: 0.7,
  squash: 0.3,
  browL: 0.5,
  browR: 0.45,
  browTiltL: 0.35,
  browTiltR: 0.35,
  smile: -0.25,
  mouthX: -0.15,
  handL: OPEN,
  handR: OPEN,
};
// Pat targets on the sides of the skirt over the thighs (the arms reach no lower; patting in
// front of the skirt would be lost in the silhouette) and the raised hand between pats.
const patL = { x: -0.15, y: 0.165 },
  upL = { x: -0.165, y: 0.235 };
const patR = { x: 0.17, y: 0.16 },
  upR = { x: 0.185, y: 0.23 };

function pat(name: string, at: number, side: 'L' | 'R'): KeyInput[] {
  const down = side === 'L';
  // The patting hand lands, the other lifts; the body dips and leans toward the pat.
  const sign = down ? -1 : 1;
  return [
    {
      name: `${name} lift`,
      at: at - 0.1,
      ease: 'out',
      pose: { ...bent, bob: bent.bob - 0.004, headTilt: -0.02 * sign },
      reach: down ? { L: { at: upL }, R: { at: patR } } : { L: { at: patL }, R: { at: upR } },
      contacts: soles,
    },
    {
      name,
      at,
      ease: 'in',
      fast: true,
      pose: {
        ...bent,
        bob: bent.bob + 0.006,
        shift: 0.008 * sign,
        headTilt: 0.04 * sign,
        squash: 0.4,
      },
      reach: down ? { L: { at: patL }, R: { at: upR } } : { L: { at: upL }, R: { at: patR } },
      contacts: soles,
    },
  ];
}

export const dustKnees = defineBeat({
  id: 'dust-knees',
  label: 'Dust off the knees',
  use: 'choreography',
  surfaces: [{ id: floor, kind: 'floor', at: 0 }],
  keys: [
    {
      name: 'from get up',
      at: 0,
      pose: { bob: 0.012, squash: 0.3, armL: -0.2, armR: -0.2, browL: 0.5, browR: 0.5 },
      contacts: soles,
    },
    {
      name: 'look down',
      at: 0.25,
      pose: { ...bent, handL: 0, handR: 0, armL: 0.2, armR: 0.15, elbowL: 0.5, elbowR: -0.4 },
      contacts: soles,
    },
    ...pat('pat left', 0.42, 'L'),
    ...pat('pat right', 0.62, 'R'),
    ...pat('pat left 2', 0.82, 'L'),
    ...pat('pat right 2', 1.02, 'R'),
    {
      name: 'hmph',
      at: 1.25,
      pose: {
        ...bent,
        bob: 0.06,
        gazeY: 0.3,
        pupilY: 0,
        browL: 0.6,
        browR: 0.6,
        handL: 0,
        handR: 0,
        armL: 0.1,
        armR: 0.1,
        elbowL: 0.2,
        elbowR: -0.2,
      },
      contacts: soles,
    },
    {
      name: 'look up',
      at: 1.5,
      pose: {
        bob: 0.02,
        squash: 0.1,
        armL: -0.1,
        armR: -0.15,
        gazeY: -0.1,
        browL: 0.2,
        browR: 0.1,
      },
      contacts: soles,
    },
  ],
});
