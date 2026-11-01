import type { Artboard } from '@rive-app/webgl2/rive_advanced.mjs';
import { BodyRig, type BodyTransform } from '../../rig/body';

/** Verified direct children of tavi/upper in the committed refined export.
 * A virtual parent preserves every existing drawable index, clip ID and depth rule.
 */
export function createFoundationBody(board: Artboard) {
  function node(name: string, bone = false): BodyTransform {
    const part = (bone ? board.rootBone(name) : board.node(name)) as BodyTransform | null;
    if (!part) throw new Error('Foundation body is missing ' + name);
    return part;
  }
  const head = node('tavi/head'),
    neck = node('neck'),
    collar = node('tavi/neck/collar-anchor', true);
  return new BodyRig({
    pelvis: node('tavi/runtime/pelvis'),
    head,
    neck,
    collar,
    chest: [
      node('tavi/near-wrist-R'),
      node('tavi/near-forearm-R'),
      node('tavi/near-wrist-L'),
      node('tavi/near-forearm-L'),
      head,
      neck,
      node('shirt'),
      node('arm_2'),
      node('tavi/armR'),
      node('tavi/armL'),
      collar,
    ],
  });
}
