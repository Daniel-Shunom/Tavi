import { RuntimeLoader } from '@rive-app/webgl2';
import type {
  Artboard,
  File,
  Renderer,
  LinearAnimationInstance,
  AABB,
} from '@rive-app/webgl2/rive_advanced.mjs';
import wasmURL from '@rive-app/webgl2/rive.wasm?url';
import avatarURL from './assets/mascot.riv?url';
RuntimeLoader.setWasmUrl(wasmURL);
RuntimeLoader.setWasmFallbackUrl(null);
let bytesPromise: Promise<Uint8Array> | undefined;
function bytes() {
  bytesPromise ??= fetch(avatarURL)
    .then(async (response) => {
      if (!response.ok) throw new Error('Could not load character artwork.');
      return new Uint8Array(await response.arrayBuffer());
    })
    .catch((error: unknown) => {
      bytesPromise = undefined;
      throw error;
    });
  return bytesPromise;
}
// This runtime exposes metadata using either getters or native methods.
function property(target: object, key: string): unknown {
  const value: unknown = Reflect.get(target, key);
  return typeof value === 'function' ? Reflect.apply(value, target, []) : value;
}
function number(target: object, key: string) {
  const value = property(target, key);
  if (typeof value !== 'number' || !Number.isFinite(value))
    throw new Error('Invalid rig metadata: ' + key);
  return value;
}
function bounds(board: Artboard): AABB {
  const value = property(board, 'bounds');
  if (typeof value !== 'object' || value === null) throw new Error('Missing character bounds.');
  return {
    minX: number(value, 'minX'),
    minY: number(value, 'minY'),
    maxX: number(value, 'maxX'),
    maxY: number(value, 'maxY'),
  };
}
export interface Placement {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
}
export async function createRiveRig(canvas: HTMLCanvasElement) {
  const [runtime, data] = await Promise.all([RuntimeLoader.awaitInstance(), bytes()]);
  let file: File | undefined;
  let board: Artboard | undefined;
  let renderer: Renderer | undefined;
  const clips = new Map<
    string,
    { instance: LinearAnimationInstance; duration: number; time: number }
  >();
  let disposed = false;
  function dispose() {
    if (disposed) return;
    disposed = true;
    renderer?.bindContext?.();
    for (const clip of clips.values()) clip.instance.delete();
    clips.clear();
    board?.delete();
    file?.unref();
    renderer?.delete();
  }
  try {
    file = await runtime.load(data, undefined, false);
    renderer = runtime.makeRenderer(canvas, true);
    board = file.artboardByName('lyla animation');
    for (let index = 0; index < board.animationCount(); index++) {
      const definition = board.animationByIndex(index);
      const name = property(definition, 'name');
      if (typeof name !== 'string') throw new Error('Unnamed character animation.');
      clips.set(name, {
        instance: new runtime.LinearAnimationInstance(definition, board),
        duration: number(definition, 'duration') / number(definition, 'fps'),
        time: 0,
      });
    }
    const activeBoard = board,
      activeRenderer = renderer;
    const characterBounds = bounds(activeBoard);
    return {
      runtime,
      apply(name: string, position: number, mix = 1) {
        if (disposed) return;
        const clip = clips.get(name);
        if (!clip) throw new Error('Missing animation: ' + name);
        const seconds = Math.max(0, Math.min(0.999, position)) * clip.duration;
        clip.instance.advance(seconds - clip.time);
        clip.time = seconds;
        clip.instance.apply(Math.max(0, Math.min(1, mix)));
      },
      resize(width: number, height: number) {
        const ratio = Math.min(devicePixelRatio || 1, 2);
        canvas.width = Math.max(1, Math.round(width * ratio));
        canvas.height = Math.max(1, Math.round(height * ratio));
      },
      draw(dt: number, placement: Placement) {
        if (disposed) return;
        const ratio = Math.min(devicePixelRatio || 1, 2);
        activeBoard.advance(dt);
        // eslint-disable-next-line @typescript-eslint/no-deprecated -- clear is supported by the pinned native runtime.
        activeRenderer.clear();
        activeRenderer.save();
        activeRenderer.align(
          runtime.Fit.contain,
          runtime.Alignment.bottomCenter,
          {
            minX: (placement.x - placement.width / 2) * ratio,
            maxX: (placement.x + placement.width / 2) * ratio,
            minY: (placement.y - placement.height) * ratio,
            maxY: placement.y * ratio,
          },
          characterBounds,
        );
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
export type RiveRig = Awaited<ReturnType<typeof createRiveRig>>;
