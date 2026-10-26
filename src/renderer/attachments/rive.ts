// Glue between the Rive low-level runtime and the attachment layer.
import type { Artboard, Mat2D, RiveCanvas } from '@rive-app/webgl2/rive_advanced.mjs';
import { fromMat, type Affine, type TransformSource } from './layer';
import { artboardSection, nameComponents } from './riv/rivPatch';
import type { SlotBinding } from './schema';

export interface AttachmentRig {
  artboard: string;
  components: Readonly<Record<number, readonly [string, number]>>;
}

/** Names the rig's slot components in memory, checking each still has the expected type. */
export function patchForAttachments(bytes: Uint8Array, rig: AttachmentRig): Uint8Array {
  const { components } = artboardSection(bytes, rig.artboard);
  const names: Record<number, string> = {};
  for (const [index, [name, type]] of Object.entries(rig.components)) {
    const actual = components[Number(index)]?.typeKey;
    if (actual !== type)
      throw new Error(
        `Attachment rig mismatch at component ${index}: expected type ${String(type)}, found ${String(actual)}`,
      );
    names[Number(index)] = name;
  }
  return nameComponents(bytes, rig.artboard, names);
}

function read(matrix: Mat2D): Affine {
  const value = fromMat(matrix);
  matrix.delete();
  return value;
}

interface WorldReadable {
  worldTransform(): Mat2D;
}

/** Reads slot node world transforms from a live artboard (call after artboard.advance). */
export function riveTransformSource(board: Artboard): TransformSource {
  const cache = new Map<string, WorldReadable | null>();
  return (binding: SlotBinding) => {
    if (!binding.node) return null;
    const key = binding.kind + ':' + binding.node;
    let target = cache.get(key);
    if (target === undefined) {
      try {
        target =
          (binding.kind === 'bone'
            ? board.bone(binding.node)
            : binding.kind === 'rootBone'
              ? board.rootBone(binding.node)
              : board.node(binding.node)) ?? null;
      } catch {
        target = null;
      }
      cache.set(key, target);
    }
    return target ? read(target.worldTransform()) : null;
  };
}

/** The artboard -> canvas matrix that Renderer.align applies for the same arguments. */
export function viewMatrix(
  runtime: RiveCanvas,
  ...args: Parameters<RiveCanvas['computeAlignment']>
): Affine {
  return read(runtime.computeAlignment(...args));
}
