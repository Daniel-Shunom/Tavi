// Motion rig manifest for alisketch's "Mascot / Avatar Customization" (CC BY 4.0),
// artboard "lyla animation". Indices come from the exported file (see docs/motion/ASSET-AUDIT.md);
// expectTypes guards against silently driving the wrong object if the asset is replaced.
import { RiveProperty, type ControlTrack, type RigPatch } from '../rive/patch';

const JOYSTICK = 148;
const NODE = 2;
const BONE = 40;
const ROOT_BONE = 41;

/** Joystick axes the artist animated every expression through (-1..1, clips overshoot ~1.1). */
const joysticks = {
  faceX: { index: 704, axis: 'x' },
  faceY: { index: 704, axis: 'y' },
  browLeft: { index: 697, axis: 'y' },
  browRight: { index: 693, axis: 'y' },
  blinkLeft: { rest: -1, index: 700, axis: 'y' },
  blinkRight: { rest: -1, index: 702, axis: 'y' },
  lidLeft: { rest: 1, index: 705, axis: 'y' },
  lidRight: { rest: 1, index: 703, axis: 'y' },
  mouthX: { index: 696, axis: 'x' },
  mouthY: { index: 696, axis: 'y' },
  mouthCurve: { index: 699, axis: 'y' },
  squash: { index: 698, axis: 'y' },
  hairSwing: { index: 695, axis: 'x' },
  hairSwoop: { index: 701, axis: 'x' },
  hairSquash: { index: 692, axis: 'y' },
} as const;

export type LylaChannel = keyof typeof joysticks;

/** Transform components given runtime names for additive procedural offsets. */
const nodes = {
  root: { index: 1, type: NODE },
  armTargetA: { index: 3, type: NODE },
  armTargetB: { index: 4, type: NODE },
  n7: { index: 7, type: NODE },
  body: { index: 8, type: NODE },
  upper: { index: 9, type: NODE },
  n11: { index: 11, type: NODE },
  n12: { index: 12, type: NODE },
  n13: { index: 13, type: NODE },
  face: { index: 26, type: NODE },
  hair: { index: 303, type: NODE },
  n658: { index: 658, type: NODE },
  n672: { index: 672, type: NODE },
  hairBoneA: { index: 68, type: BONE },
  hairBoneB: { index: 86, type: BONE },
  rb490: { index: 490, type: ROOT_BONE },
  rb558: { index: 558, type: ROOT_BONE },
  rb660: { index: 660, type: ROOT_BONE },
  rb674: { index: 674, type: ROOT_BONE },
  b661: { index: 661, type: BONE },
  b675: { index: 675, type: BONE },
} as const;

export type LylaNode = keyof typeof nodes;

const CONTROL_RANGE = 1.25;
const controls: ControlTrack[] = Object.entries(joysticks).map(([channel, joystick]) => ({
  name: 'tavi/' + channel,
  objectIndex: joystick.index,
  propertyKey: joystick.axis === 'x' ? RiveProperty.joystickX : RiveProperty.joystickY,
  min: -CONTROL_RANGE,
  max: CONTROL_RANGE,
}));

const expectTypes: Record<number, number> = {};
for (const joystick of Object.values(joysticks)) expectTypes[joystick.index] = JOYSTICK;
for (const node of Object.values(nodes)) expectTypes[node.index] = node.type;

export const lylaPatch: RigPatch = {
  artboard: 'lyla animation',
  names: Object.fromEntries(
    Object.entries(nodes).map(([name, node]) => [node.index, 'tavi/' + name]),
  ),
  controls,
  expectTypes,
};

export const lylaRig = {
  artboard: 'lyla animation',
  channels: Object.fromEntries(
    Object.entries(joysticks).map(([channel, joystick]) => [
      channel,
      {
        track: 'tavi/' + channel,
        min: -CONTROL_RANGE,
        max: CONTROL_RANGE,
        rest: 'rest' in joystick ? joystick.rest : 0,
      },
    ]),
  ) as Record<LylaChannel, { track: string; min: number; max: number; rest: number }>,
  nodes: Object.fromEntries(
    Object.entries(nodes).map(([name, node]) => [
      name,
      {
        name: 'tavi/' + name,
        kind: node.type === BONE ? 'bone' : node.type === ROOT_BONE ? 'rootBone' : 'node',
      },
    ]),
  ) as Record<LylaNode, { name: string; kind: 'node' | 'bone' | 'rootBone' }>,
};
