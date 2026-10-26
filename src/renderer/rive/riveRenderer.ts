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
import type { CharacterRenderer, Decorator, Look, Placement, RenderFrame } from '../adapter';
import { patchForAttachments, riveTransformSource, viewMatrix } from '../attachments/rive';
import { hide, recolor } from '../attachments/recolor';
import type { TransformSource } from '../attachments/layer';
import type { CharacterAttachments } from '../characters/attachmentRigs';
import { assetUrl } from '../characters/assets';
import { motionRigs } from '../characters/motionRigs';
import { patchRiv } from '../motion/rive/patch';
import type { CharacterManifest } from '../characters/manifest';
import { drawFrame } from '../placement';
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
  options: { look?: Look; attachments?: CharacterAttachments | undefined } = {},
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
  // Inputs must be accessed through their typed view (asBool/asNumber/asTrigger); setting
  // `value` on the base input object is silently ignored by the pinned 2.45 runtime.
  const inputs = new Map<
    string,
    { kind: 'bool' | 'number' | 'trigger'; input: SMIInput; last?: boolean | number }
  >();
  const nodes = new Map<
    string,
    { node: Node; base: { x: number; y: number; rotation: number; scaleX: number; scaleY: number } }
  >();
  let appearance: Record<string, string> = {};
  // Appearance options whose animation was rewritten in memory (custom colour, hidden glasses).
  const forced: Record<string, string> = {};
  let decorator: Decorator | null = null;
  let world: TransformSource | null = null;
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
    // One load path: motion rig names, attachment slot names, then recolour/hide, all in memory.
    const rig = motionRigs[manifest.id];
    let patched = rig ? patchRiv(data, rig.patch) : data;
    const attachments = options.attachments;
    if (attachments) {
      patched = patchForAttachments(patched, attachments.rig);
      const { artboard, hair, outfit, glasses } = attachments.recolor;
      const force = (animation: string) => {
        for (const [slot, definition] of Object.entries(manifest.appearance)) {
          const option = definition.options.find(
            (candidate) => manifest.tracks[candidate.track] === animation,
          );
          if (option) forced[slot] = option.id;
        }
      };
      const look = options.look ?? {};
      if (hair && look.hairColor) {
        patched = recolor(patched, artboard, hair, look.hairColor);
        force(hair.animation);
      }
      if (outfit && look.outfitColor) {
        patched = recolor(patched, artboard, outfit, look.outfitColor);
        force(outfit.animation);
      }
      if (glasses && look.hideGlasses) {
        patched = hide(patched, artboard, glasses);
        force(glasses.animation);
      }
    }
    file = await runtime.load(patched, undefined, false);
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
        const type = property(input, 'type');
        if (type === runtime.SMIInput.bool)
          inputs.set(handle, { kind: 'bool', input: input.asBool() });
        else if (type === runtime.SMIInput.number)
          inputs.set(handle, { kind: 'number', input: input.asNumber() });
        else if (type === runtime.SMIInput.trigger)
          inputs.set(handle, { kind: 'trigger', input: input.asTrigger() });
        else throw new Error(`${manifest.id}: unsupported input type for ${handle}`);
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
    if (attachments) world = riveTransformSource(activeBoard);
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
        const chosen = forced[slot] ?? appearance[slot] ?? definition.default;
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
      setDecorator(next) {
        decorator = next;
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
          const entry = inputs.get(handle);
          if (!entry) continue;
          if (entry.kind === 'trigger') {
            // Fire on a rising edge (false -> true or a changed number).
            if (value && value !== entry.last) entry.input.fire();
          } else if (entry.kind === 'bool') entry.input.value = Boolean(value);
          else entry.input.value = Number(value);
          entry.last = value;
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
        // Soles on placement.y; attachments use the same frame, so they follow.
        const frame = drawFrame(placement, ratio, characterBounds, manifest.soleOffset);
        activeRenderer.align(
          runtime.Fit.contain,
          runtime.Alignment.bottomCenter,
          frame,
          characterBounds,
        );
        // Attachments use exactly the same alignment, in device pixels.
        if (decorator && world)
          decorator(
            viewMatrix(
              runtime,
              runtime.Fit.contain,
              runtime.Alignment.bottomCenter,
              frame,
              characterBounds,
            ),
            world,
            dt,
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
