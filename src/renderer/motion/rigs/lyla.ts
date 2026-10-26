// Motion rig manifest for alisketch's "Mascot / Avatar Customization" (CC BY 4.0),
// artboard "lyla animation". Indices come from the exported file (see docs/motion/ASSET-AUDIT.md);
// expectTypes guards against silently driving the wrong object if the asset is replaced.
import { RiveProperty, type ControlTrack, type RigPatch } from '../rive/patch';

const JOYSTICK = 148;
const NODE = 2;

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
  // Roles verified visually with tools/motion-lab/probe.mjs (see docs/motion/ASSET-AUDIT.md).
  footL: { index: 3, type: NODE }, // screen-left foot IK target
  footR: { index: 4, type: NODE }, // screen-right foot IK target
  body: { index: 8, type: NODE }, // hips: offsets crouch/rise/shift with feet planted
  upper: { index: 9, type: NODE }, // torso lean over planted feet
  head: { index: 11, type: NODE }, // head roll around the neck
  armL: { index: 672, type: NODE }, // screen-left arm (positive rotation raises outward)
  armR: { index: 658, type: NODE }, // screen-right arm (negative rotation raises outward)
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
    Object.keys(nodes).map((name) => [
      name,
      {
        name: 'tavi/' + name,
        kind: 'node',
      },
    ]),
  ) as Record<LylaNode, { name: string; kind: 'node' | 'bone' | 'rootBone' }>,
};
