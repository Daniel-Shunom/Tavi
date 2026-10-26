// Reading chat is an upright floor hold. Vary the upper-body attitude while both soles stay
// level: no dropped hips, spread feet, root rotation or borrowed sitting/kneeling pose.
import { defineBeat, type BeatInput } from '../schema';

const planted = {
  bob: 0,
  shift: 0,
  squash: 0,
  footLX: 0,
  footRX: 0,
  footLY: 0,
  footRY: 0,
};
const contacts = [
  { part: 'soleL' as const, surface: 'floor' },
  { part: 'soleR' as const, surface: 'floor' },
];
const life: BeatInput['life'] = [
  { channel: 'headY', amplitude: 0.0035, period: 4.2, shape: 'sine' },
  { channel: 'headTilt', amplitude: 0.018, period: 7.3, shape: 'noise' },
  { channel: 'lean', amplitude: 0.012, period: 9.1, shape: 'noise' },
];

export const peekAttentive = defineBeat({
  id: 'peek-standing-attentive',
  label: 'Read chat: attentive standing',
  use: 'hold',
  keys: [
    {
      name: 'attentive',
      at: 0,
      contacts,
      pose: {
        ...planted,
        lean: -0.045,
        headTilt: -0.035,
        armL: 0.035,
        armR: 0.09,
        gazeX: 0.8,
        gazeY: -0.2,
        browL: -0.35,
        browR: -0.3,
        smile: 0.1,
      },
    },
  ],
  life,
});

export const peekCurious = defineBeat({
  id: 'peek-standing-curious',
  label: 'Read chat: curious standing',
  use: 'hold',
  keys: [
    {
      name: 'curious',
      at: 0,
      contacts,
      pose: {
        ...planted,
        lean: -0.065,
        headTilt: 0.09,
        armL: 0.02,
        armR: 0.3,
        elbowR: 0.9,
        handR: 1,
        armsFront: 1,
        gazeX: 0.75,
        gazeY: -0.15,
        browL: -0.55,
        browR: -0.2,
        smile: 0.15,
      },
    },
  ],
  life,
});

export const peekRelaxed = defineBeat({
  id: 'peek-standing-relaxed',
  label: 'Read chat: relaxed standing',
  use: 'hold',
  keys: [
    {
      name: 'relaxed',
      at: 0,
      contacts,
      pose: {
        ...planted,
        lean: 0.02,
        headTilt: -0.08,
        armL: 0.18,
        elbowL: -0.55,
        armR: -0.08,
        gazeX: 0.65,
        gazeY: -0.2,
        browL: -0.25,
        browR: -0.4,
        smile: 0.2,
      },
    },
  ],
  life,
});

export const peekStandingVariants = [peekAttentive, peekCurious, peekRelaxed] as const;
