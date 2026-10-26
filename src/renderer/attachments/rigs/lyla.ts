// Attachment slots for alisketch's "Mascot / Avatar Customization" (CC BY 4.0), artboard
// "lyla animation". Component indices were found with tools/assets/probe.ts; exported files strip
// names, so nameComponents() adds runtime names in memory before loading. expectTypes guards
// against silently binding the wrong component if the asset is replaced.
// INTEGRATION: these belong in the character manifest (see docs/assets/INTEGRATION.md).
import type { CharacterSlots } from '../schema';

const NODE = 2;
const BONE = 40;

export const lylaAttachmentRig = {
  artboard: 'lyla animation',
  /** component index -> [runtime name, expected type key] */
  components: {
    10: ['tavi/attach/upper', NODE], // upper body (child of the torso-lean node)
    12: ['tavi/attach/head', NODE], // head contents; includes head roll and squash
    661: ['tavi/attach/forearmR', BONE], // screen-right forearm, 46.9 units long
    675: ['tavi/attach/forearmL', BONE], // screen-left forearm, 46.9 units long
  } as Readonly<Record<number, readonly [string, number]>>,
};

// Head node rests at (307, 313.5) in artboard units; hair spans roughly x 150..465, top y ~60;
// the face (skin) is ~180 units wide with the eye line at y 230. The body is small (~80 wide).
export const lylaSlots: CharacterSlots = {
  'head.top': { node: 'tavi/attach/head', kind: 'node', offset: [0, -238], size: 300, follow: 1, rotation: 0 },
  'head.face': { node: 'tavi/attach/head', kind: 'node', offset: [0, -83], size: 180, follow: 1, rotation: 0 },
  'head.back': { node: 'tavi/attach/head', kind: 'node', offset: [0, -150], size: 300, follow: 1, rotation: 0 },
  'head.side': { node: 'tavi/attach/head', kind: 'node', offset: [112, -205], size: 300, follow: 1, rotation: 0 },
  neck: { node: 'tavi/attach/upper', kind: 'node', offset: [0, -88], size: 100, follow: 1, rotation: 0 },
  torso: { node: 'tavi/attach/upper', kind: 'node', offset: [0, -40], size: 100, follow: 1, rotation: 0 },
  'hand.r': { node: 'tavi/attach/forearmR', kind: 'bone', offset: [46.9, 0], size: 100, follow: 0.25, rotation: 0 },
  'hand.l': { node: 'tavi/attach/forearmL', kind: 'bone', offset: [46.9, 0], size: 100, follow: 0.25, rotation: 0 },
};
