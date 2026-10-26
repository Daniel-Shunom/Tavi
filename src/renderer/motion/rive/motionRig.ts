// Low-level Rive adapter for the motion layer. Loads a .riv, applies an in-memory RigPatch
// (runtime names + control tracks), and exposes per-frame channel writes:
//   clip(name, time, mix)         authored clips, advanced smoothly by the caller
//   channel(name, value, weight)  joystick channels via control tracks (absolute, blended by weight)
//   offset(node, transform)       additive offsets on named nodes/bones (read-modify-write)
// Frame order is fixed in frame(): reset -> clips -> channels -> offsets -> advance -> draw.
import type {
  AABB,
  Artboard,
  File,
  LinearAnimationInstance,
  Mat2D,
  Node,
  Renderer,
  RiveCanvas,
} from '@rive-app/webgl2/rive_advanced.mjs';
import { controlTime, patchRiv, type RigPatch } from './patch';

export interface NodeOffset {
  x?: number;
  y?: number;
  rotation?: number;
  scaleX?: number;
  scaleY?: number;
}

export interface FrameInput {
  clips: readonly { name: string; time: number; mix: number }[];
  channels: Readonly<Record<string, { value: number; weight: number } | undefined>>;
  offsets: Readonly<Record<string, NodeOffset | undefined>>;
}

export interface Placement {
  /** Bottom-centre of the character in CSS pixels. */
  x: number;
  y: number;
  /** Rendered artboard height in CSS pixels; width follows the artboard aspect. */
  height: number;
  /** Lean around the feet, radians. */
  rotation: number;
  /** Horizontal facing: 1 or -1, or values between while turning (narrows the silhouette). */
  facing: number;
  /** Host-level squash/stretch around the feet (1 = none). */
  scaleX: number;
  scaleY: number;
}

export interface RigManifest {
  artboard: string;
  channels: Readonly<Record<string, { track: string; min: number; max: number; rest?: number }>>;
  nodes: Readonly<Record<string, { name: string; kind: 'node' | 'bone' | 'rootBone' }>>;
}

interface Clip {
  instance: LinearAnimationInstance;
  duration: number;
  time: number;
}

type Transform = Required<NodeOffset>;
/** Node and RootBone carry x/y; Bone positions come from its parent, so x/y stay 0 there. */
type Target = Partial<Pick<Node, 'x' | 'y'>> & Pick<Node, 'rotation' | 'scaleX' | 'scaleY'>;

function readTransform(node: Target): Transform {
  return {
    x: node.x ?? 0,
    y: node.y ?? 0,
    rotation: node.rotation,
    scaleX: node.scaleX,
    scaleY: node.scaleY,
  };
}

function writeTransform(node: Target, value: Transform, positioned: boolean) {
  if (positioned) {
    node.x = value.x;
    node.y = value.y;
  }
  node.rotation = value.rotation;
  node.scaleX = value.scaleX;
  node.scaleY = value.scaleY;
}

// The pinned runtime exposes metadata as either getters or native methods depending on the
// object (same workaround as riveRig.ts). Reading a method as a value yields NaN durations.
function metadata(target: object, key: string): number;
function metadata(target: object, key: string, kind: 'string'): string;
function metadata(target: object, key: string, kind: 'number' | 'string' = 'number') {
  const raw: unknown = Reflect.get(target, key);
  const value: unknown = typeof raw === 'function' ? Reflect.apply(raw, target, []) : raw;
  if (typeof value !== kind) throw new Error('Invalid rig metadata: ' + key);
  return value;
}

function readBounds(board: Artboard): AABB {
  const value: unknown = Reflect.get(board, 'bounds');
  const raw: unknown = typeof value === 'function' ? Reflect.apply(value, board, []) : value;
  if (typeof raw !== 'object' || raw === null) throw new Error('Missing artboard bounds.');
  return {
    minX: metadata(raw, 'minX'),
    minY: metadata(raw, 'minY'),
    maxX: metadata(raw, 'maxX'),
    maxY: metadata(raw, 'maxY'),
  };
}

export async function createMotionRig(
  runtime: RiveCanvas,
  canvas: HTMLCanvasElement,
  source: Uint8Array,
  patch: RigPatch,
  manifest: RigManifest,
) {
  const data = patchRiv(source, patch);
  let file: File | undefined;
  let board: Artboard | undefined;
  let renderer: Renderer | undefined;
  const clips = new Map<string, Clip>();
  let disposed = false;
  let matrixRef: Mat2D | undefined;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    for (const clip of clips.values()) clip.instance.delete();
    clips.clear();
    board?.delete();
    file?.unref();
    renderer?.delete();
    matrixRef?.delete();
  };
  try {
    file = await runtime.load(data, undefined, false);
    renderer = runtime.makeRenderer(canvas, true);
    board = file.artboardByName(manifest.artboard);
    for (let index = 0; index < board.animationCount(); index++) {
      const definition = board.animationByIndex(index);
      const instance = new runtime.LinearAnimationInstance(definition, board);
      const duration = metadata(definition, 'duration') / metadata(definition, 'fps');
      if (!Number.isFinite(duration) || duration <= 0)
        throw new Error('Invalid clip duration: ' + metadata(definition, 'name', 'string'));
      clips.set(metadata(definition, 'name', 'string'), { instance, duration, time: 0 });
    }
    const activeBoard = board,
      activeRenderer = renderer;
    const nodes = new Map<string, { node: Target; setup: Transform; positioned: boolean }>();
    for (const [role, entry] of Object.entries(manifest.nodes)) {
      // The runtime's lookups are typed: node() only matches Nodes, bone() Bones, rootBone() roots.
      const found: Target | null =
        entry.kind === 'node'
          ? activeBoard.node(entry.name)
          : entry.kind === 'rootBone'
            ? activeBoard.rootBone(entry.name)
            : activeBoard.bone(entry.name);
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- wasm returns null when absent.
      if (found)
        nodes.set(role, {
          node: found,
          setup: readTransform(found),
          positioned: entry.kind !== 'bone',
        });
    }
    let pixelRatio = 1;
    const matrix = new runtime.Mat2D();
    matrixRef = matrix;
    const bounds = readBounds(activeBoard);
    const missingChannels = Object.entries(manifest.channels)
      .filter(([, channel]) => !clips.has(channel.track))
      .map(([name]) => name);
    if (missingChannels.length)
      throw new Error('Missing control tracks: ' + missingChannels.join(', '));

    function applyClip(name: string, seconds: number, mix: number) {
      const clip = clips.get(name);
      if (!clip || mix <= 0) return;
      const time = Math.min(clip.duration, Math.max(0, seconds));
      clip.instance.advance(time - clip.time);
      clip.time = time;
      clip.instance.apply(Math.min(1, mix));
    }

    return {
      runtime,
      artboard: activeBoard,
      bounds,
      /** Roles from the manifest that resolved to real nodes in this file. */
      nodeRoles: [...nodes.keys()],
      clipNames: [...clips.keys()],
      clipDuration(name: string) {
        return clips.get(name)?.duration ?? 0;
      },
      resize(width: number, height: number, ratio = Math.min(devicePixelRatio || 1, 2)) {
        pixelRatio = ratio;
        canvas.width = Math.max(1, Math.round(width * ratio));
        canvas.height = Math.max(1, Math.round(height * ratio));
      },
      /** Current transform of a named role after the last frame (for attachment/debug). */
      read(role: string) {
        const entry = nodes.get(role);
        return entry ? readTransform(entry.node) : undefined;
      },
      frame(dt: number, input: FrameInput, placement: Placement) {
        if (disposed) return;
        // 1. Reset: named nodes to setup pose, channels to rest (joystick values persist otherwise).
        for (const { node, setup, positioned } of nodes.values())
          writeTransform(node, setup, positioned);
        for (const channel of Object.values(manifest.channels))
          applyClip(channel.track, controlTime(channel, channel.rest ?? 0), 1);
        // 2. Authored clips in caller order (later clips blend over earlier ones).
        for (const clip of input.clips) applyClip(clip.name, clip.time, clip.mix);
        // 3. Procedural channel targets, blended over whatever the clips keyed.
        for (const [name, write] of Object.entries(input.channels)) {
          const channel = manifest.channels[name];
          if (!channel || !write || write.weight <= 0) continue;
          applyClip(channel.track, controlTime(channel, write.value), write.weight);
        }
        // 4. Additive offsets on top of the posed nodes.
        for (const [role, offset] of Object.entries(input.offsets)) {
          const entry = nodes.get(role);
          if (!entry || !offset) continue;
          const node = entry.node;
          if (entry.positioned && offset.x) node.x = (node.x ?? 0) + offset.x;
          if (entry.positioned && offset.y) node.y = (node.y ?? 0) + offset.y;
          if (offset.rotation) node.rotation += offset.rotation;
          if (offset.scaleX !== undefined) node.scaleX *= offset.scaleX;
          if (offset.scaleY !== undefined) node.scaleY *= offset.scaleY;
        }
        // 5. Joysticks re-apply their channel clips here; then components update.
        activeBoard.advance(dt);
        const ratio = pixelRatio;
        // eslint-disable-next-line @typescript-eslint/no-deprecated -- clear is supported by the pinned native runtime.
        activeRenderer.clear();
        activeRenderer.save();
        const pivotX = placement.x * ratio,
          pivotY = placement.y * ratio;
        // The WebGL2 renderer has no translate/rotate; compose a matrix: T(p) R(a) T(-p).
        if (placement.rotation) {
          const cos = Math.cos(placement.rotation),
            sin = Math.sin(placement.rotation);
          setMatrix(
            matrix,
            cos,
            sin,
            -sin,
            cos,
            pivotX - cos * pivotX + sin * pivotY,
            pivotY - sin * pivotX - cos * pivotY,
          );
          activeRenderer.transform(matrix);
        }
        const facing = Math.abs(placement.facing) < 0.02 ? 0.02 : placement.facing;
        const aspect = (bounds.maxX - bounds.minX) / Math.max(1, bounds.maxY - bounds.minY);
        const height = placement.height * placement.scaleY;
        const halfWidth = ((placement.height * aspect) / 2) * placement.scaleX * Math.abs(facing);
        activeRenderer.align(
          runtime.Fit.fill,
          runtime.Alignment.bottomCenter,
          {
            minX: (placement.x - halfWidth) * ratio,
            maxX: (placement.x + halfWidth) * ratio,
            minY: (placement.y - height) * ratio,
            maxY: placement.y * ratio,
          },
          bounds,
        );
        if (facing < 0) {
          // Mirror around the artboard's horizontal centre.
          const centre = (bounds.minX + bounds.maxX) / 2;
          setMatrix(matrix, -1, 0, 0, 1, 2 * centre, 0);
          activeRenderer.transform(matrix);
        }
        activeBoard.draw(activeRenderer);
        activeRenderer.restore();
        activeRenderer.flush();
        runtime.resolveAnimationFrame();
      },
      dispose,
    };
  } catch (error) {
    dispose();
    throw error;
  }
}

function setMatrix(
  matrix: Mat2D,
  xx: number,
  xy: number,
  yx: number,
  yy: number,
  tx: number,
  ty: number,
) {
  matrix.xx = xx;
  matrix.xy = xy;
  matrix.yx = yx;
  matrix.yy = yy;
  matrix.tx = tx;
  matrix.ty = ty;
}

export type MotionRig = Awaited<ReturnType<typeof createMotionRig>>;
