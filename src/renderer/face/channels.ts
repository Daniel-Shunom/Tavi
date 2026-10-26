// Face channels: the facial subset of the motion layer's abstract channels (same names and
// units as src/renderer/motion/types.ts), so face poses add straight onto motion poses.
// A character's manifest says which channels its rig supports and their safe ranges.
//
//   gazeX/gazeY   -1..1   look / face turn (x: screen right, y: down)
//   browL/browR   -1 raised .. 1 lowered (L/R are screen-left/right in the unmirrored artboard)
//   squintL/R      0..1   upper lid lowered (heavy-lidded, suspicious, annoyed)
//   blinkL/R       0..1   eye closed (lash line down); also held for happy or sleepy eyes
//   smile         -1 frown .. 1 smile (mouth corner curve)
//   mouthX        -1..1   mouth shifted sideways (smirks, disgust)
//   mouthY        -1..1   mouth raised (pursed, small) .. lowered (wide, open-looking)
//   squash        -1 stretch .. 1 squash (whole-head volume)
//   headTilt      radians, head roll (positive tilts toward screen right)
export const faceChannels = [
  'gazeX',
  'gazeY',
  'browL',
  'browR',
  'squintL',
  'squintR',
  'blinkL',
  'blinkR',
  'smile',
  'mouthX',
  'mouthY',
  'squash',
  'headTilt',
] as const;
export type FaceChannel = (typeof faceChannels)[number];
export type FaceValues = Partial<Record<FaceChannel, number>>;

/** Channel groups move with different timing: the upper face leads, the mouth follows. */
export const channelGroup: Record<FaceChannel, 'eyes' | 'brows' | 'mouth' | 'head'> = {
  gazeX: 'eyes',
  gazeY: 'eyes',
  browL: 'brows',
  browR: 'brows',
  squintL: 'eyes',
  squintR: 'eyes',
  blinkL: 'eyes',
  blinkR: 'eyes',
  smile: 'mouth',
  mouthX: 'mouth',
  mouthY: 'mouth',
  squash: 'head',
  headTilt: 'head',
};

export function isFaceChannel(value: string): value is FaceChannel {
  return (faceChannels as readonly string[]).includes(value);
}
