// Rive implementation of CharacterRenderer, driven entirely by a character manifest.
import { RuntimeLoader } from '@rive-app/webgl2';
import type {
  AABB,
  Artboard,
  File,
  LinearAnimationInstance,
  Renderer,
  SMIInput,
  StateMachineInstance,
  Node,
} from '@rive-app/webgl2/rive_advanced.mjs';
import wasmURL from '@rive-app/webgl2/rive.wasm?url';
import type { CharacterRenderer, Placement, RenderFrame } from '../adapter';
import { assetUrl } from '../characters/assets';
import { motionRigs } from '../characters/motionRigs';
import { patchRiv } from '../motion/rive/patch';
import type { CharacterManifest } from '../characters/manifest';
RuntimeLoader.setWasmUrl(wasmURL);
RuntimeLoader.setWasmFallbackUrl(null);

const cache = new Map<string, Promise<Uint8Array>>();
function bytes(url: string) {
  let pending = cache.get(url);
  if (!pending) {
    pending = fetch(url)
      .then(async (response) => {
        if (!response.ok) throw new Error('Could not load character artwork.');
        return new Uint8Array(await response.arrayBuffer());
      })
      .catch((error: unknown) => {
        cache.delete(url);
        throw error;
      });
    cache.set(url, pending);
  }
  return pending;
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
const clamp = (value: number, min = 0, max = 1) => Math.max(min, Math.min(max, value));

export async function createRiveRenderer(
  canvas: HTMLCanvasElement,
  manifest: CharacterManifest,
): Promise<
  CharacterRenderer & {
    debugClips(): string[];
    debugSample(track: string | null, position: number): void;
  }
> {
  const [runtime, data] = await Promise.all([
    RuntimeLoader.awaitInstance(),
    bytes(assetUrl(manifest)),
  ]);
  let file: File | undefined;
  let board: Artboard | undefined;
  let renderer: Renderer | undefined;
  let machine: StateMachineInstance | undefined;
  const tracks = new Map<
    string,
    { instance: LinearAnimationInstance; duration: number; time: number }
  >();
  const inputs = new Map<string, SMIInput>();
  const nodes = new Map<
    string,
    { node: Node; base: { x: number; y: number; rotation: number; scaleX: number; scaleY: number } }
  >();
  let appearance: Record<string, string> = {};
  let disposed = false;
  function dispose() {
    if (disposed) return;
    disposed = true;
    renderer?.bindContext?.();
    for (const clip of tracks.values()) clip.instance.delete();
    tracks.clear();
    machine?.delete();
    board?.delete();
    file?.unref();
    renderer?.delete();
  }
  try {
    // Motion rig extension (runtime names + control tracks), applied in memory; the .riv is unchanged.
    const rig = motionRigs[manifest.id];
    file = await runtime.load(rig ? patchRiv(data, rig.patch) : data, undefined, false);
    renderer = runtime.makeRenderer(canvas, true);
    board = file.artboardByName(manifest.artboard);
    const clipsByName = new Map<string, number>();
    for (let index = 0; index < board.animationCount(); index++) {
      const name = property(board.animationByIndex(index), 'name');
      if (typeof name === 'string') clipsByName.set(name, index);
    }
    for (const [handle, clip] of Object.entries(manifest.tracks)) {
      const index = clipsByName.get(clip);
      if (index === undefined)
        throw new Error(`${manifest.id}: missing animation for track ${handle}`);
      const definition = board.animationByIndex(index);
      tracks.set(handle, {
        instance: new runtime.LinearAnimationInstance(definition, board),
        duration: number(definition, 'duration') / number(definition, 'fps'),
        time: 0,
      });
    }
    if (manifest.stateMachine) {
      machine = new runtime.StateMachineInstance(
        board.stateMachineByName(manifest.stateMachine),
        board,
      );
      const byName = new Map<string, SMIInput>();
      for (let index = 0; index < machine.inputCount(); index++) {
        const input = machine.input(index);
        byName.set(String(property(input, 'name')), input);
      }
      for (const [handle, name] of Object.entries(manifest.inputs)) {
        const input = byName.get(name);
        if (!input) throw new Error(`${manifest.id}: missing state machine input ${handle}`);
        inputs.set(handle, input);
      }
    }
    for (const [handle, name] of Object.entries(manifest.nodes)) {
      const node = board.node(name);
      nodes.set(handle, {
        node,
        base: {
          x: node.x,
          y: node.y,
          rotation: node.rotation,
          scaleX: node.scaleX,
          scaleY: node.scaleY,
        },
      });
    }
    const activeBoard = board,
      activeRenderer = renderer;
    const characterBounds = bounds(activeBoard);
    function apply(handle: string, position: number, mix: number) {
      const clip = tracks.get(handle);
      if (!clip) throw new Error(`${manifest.id}: unknown track ${handle}`);
      const seconds = clamp(position, 0, 0.999) * clip.duration;
      clip.instance.advance(seconds - clip.time);
      clip.time = seconds;
      clip.instance.apply(clamp(mix));
    }
    function applyRest() {
      for (const sample of manifest.rest) apply(sample.track, sample.at ?? 0, sample.mix);
    }
    function applyAppearance() {
      for (const [slot, definition] of Object.entries(manifest.appearance)) {
        const chosen = appearance[slot] ?? definition.default;
        const option =
          definition.options.find((candidate) => candidate.id === chosen) ??
          definition.options.find((candidate) => candidate.id === definition.default);
        if (option) apply(option.track, 0, 1);
      }
    }
    return {
      manifest,
      setAppearance(selection) {
        appearance = { ...selection };
      },
      applyFrame(frame: RenderFrame) {
        if (disposed) return;
        // Nodes return to their setup pose before clips, so motion offsets add on top of the
        // animated values instead of replacing them (and never accumulate).
        for (const entry of nodes.values()) {
          entry.node.x = entry.base.x;
          entry.node.y = entry.base.y;
          entry.node.rotation = entry.base.rotation;
          entry.node.scaleX = entry.base.scaleX;
          entry.node.scaleY = entry.base.scaleY;
        }
        applyRest();
        for (const sample of frame.tracks)
          if (sample.mix > 0) apply(sample.track, sample.time, sample.mix);
        // Palette tracks last so poses never overwrite the chosen colours.
        applyAppearance();
        for (const [handle, value] of Object.entries(frame.inputs)) {
          const input = inputs.get(handle);
          if (input) input.value = value;
        }
        for (const [handle, entry] of nodes) {
          const offset = frame.nodes[handle] ?? {};
          entry.node.x += offset.x ?? 0;
          entry.node.y += offset.y ?? 0;
          entry.node.rotation += offset.rotation ?? 0;
          entry.node.scaleX *= offset.scaleX ?? 1;
          entry.node.scaleY *= offset.scaleY ?? 1;
        }
      },
      resize(width, height) {
        const ratio = Math.min(devicePixelRatio || 1, 2);
        canvas.width = Math.max(1, Math.round(width * ratio));
        canvas.height = Math.max(1, Math.round(height * ratio));
      },
      draw(dt: number, placement: Placement) {
        if (disposed) return;
        const ratio = Math.min(devicePixelRatio || 1, 2);
        machine?.advance(dt);
        activeBoard.advance(dt);
        // eslint-disable-next-line @typescript-eslint/no-deprecated -- the pinned 2.45 runtime lacks beginFrame.
        activeRenderer.clear();
        activeRenderer.save();
        // Rotate around the bottom-centre anchor so the character pivots from its feet. The
        // pinned 2.45 runtime has no renderer translate/rotate, and each canvas holds exactly
        // one character, so rotate the canvas itself around the same pivot.
        const degrees = Math.round(placement.rotation * 100) / 100;
        const origin = `${placement.x.toFixed(1)}px ${placement.y.toFixed(1)}px`;
        if (canvas.style.transformOrigin !== origin) canvas.style.transformOrigin = origin;
        const transform = degrees ? `rotate(${String(degrees)}deg)` : '';
        if (canvas.style.transform !== transform) canvas.style.transform = transform;
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
      requestFrame: (callback) => runtime.requestAnimationFrame(callback),
      cancelFrame: (id) => {
        runtime.cancelAnimationFrame(id);
      },
      dispose,
      debugClips: () => [...tracks.keys()],
      debugSample(track, position) {
        applyRest();
        if (track) apply(track, position, 1);
        applyAppearance();
      },
    };
  } catch (error) {
    dispose();
    throw error;
  }
}
