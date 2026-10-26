// Pose-lab puppet: draws a character exactly as the overlay does (manifest tracks + the
// character's motion binding, rest samples, default appearance, additive node offsets), and
// exposes world transforms of the rig's bones for overlays and measurement. Dev tool only.
import type {
  AABB,
  Artboard,
  LinearAnimationInstance,
  Mat2D,
  Renderer,
  RiveCanvas,
} from '@rive-app/webgl2/rive_advanced.mjs';
import { assetUrl } from '../../src/renderer/characters/assets';
import { getCharacter } from '../../src/renderer/characters/registry';
import { motionRigs } from '../../src/renderer/characters/motionRigs';
import { patchRiv } from '../../src/renderer/motion/rive/patch';
import { neutralPose, type MotionFrame, type Pose } from '../../src/renderer/motion/types';

type Target = { rotation: number; scaleX: number; scaleY: number; x?: number; y?: number } & {
  worldTransform(): Mat2D;
};

/** Bones read for measurement (by exact name; leg roots are unique, knees are not). */
const extraBones: Record<string, { name: string; kind: 'bone' | 'rootBone' }> = {
  'arm-l-upper': { name: 'tavi/armL.upper', kind: 'rootBone' },
  'arm-r-upper': { name: 'tavi/armR.upper', kind: 'rootBone' },
  'leg-l': { name: 'Left LEG BONE', kind: 'rootBone' },
  'leg-r': { name: 'RIGHT LEG BONE', kind: 'rootBone' },
};

export interface Draw {
  /** Soles' centre in CSS px. */
  x: number;
  y: number;
  /** Body height (artboard height) in CSS px. */
  bodyPx: number;
  /** Degrees clockwise about the soles. */
  rotation: number;
  facing: 1 | -1;
  /** Additional host squash (hops). */
  scaleX?: number;
  scaleY?: number;
}

function meta(target: object, key: string): unknown {
  const raw: unknown = Reflect.get(target, key);
  return typeof raw === 'function' ? Reflect.apply(raw, target, []) : raw;
}

export async function createPuppet(
  runtime: RiveCanvas,
  canvas: HTMLCanvasElement,
  characterId: string,
) {
  const manifest = getCharacter(characterId);
  const rig = motionRigs[manifest.id];
  if (!rig) throw new Error('No motion rig for ' + manifest.id);
  const bytes = new Uint8Array(await (await fetch(assetUrl(manifest))).arrayBuffer());
  const file = await runtime.load(patchRiv(bytes, rig.patch), undefined, false);
  const renderer: Renderer = runtime.makeRenderer(canvas, true);
  const board: Artboard = file.artboardByName(manifest.artboard);
  const clips = new Map<
    string,
    { instance: LinearAnimationInstance; duration: number; t: number }
  >();
  for (let i = 0; i < board.animationCount(); i++) {
    const definition = board.animationByIndex(i);
    const duration = Number(meta(definition, 'duration')) / Number(meta(definition, 'fps'));
    clips.set(String(meta(definition, 'name')), {
      instance: new runtime.LinearAnimationInstance(definition, board),
      duration,
      t: 0,
    });
  }
  const nodes = new Map<
    string,
    { node: Target; positioned: boolean; base: Required<Omit<Target, 'worldTransform'>> }
  >();
  const find = (name: string, kind?: 'bone' | 'rootBone') => {
    const asNode = kind ? null : (board.node(name) as unknown as Target | null);
    const asRoot = kind === 'bone' ? null : (board.rootBone(name) as unknown as Target | null);
    const asBone = board.bone(name) as unknown as Target | null;
    const node = asNode ?? asRoot ?? asBone;
    return node ? { node, positioned: Boolean(asNode ?? asRoot) } : null;
  };
  for (const [handle, name] of Object.entries(manifest.nodes)) {
    const found = find(name);
    if (!found) throw new Error('missing node ' + name);
    const n = found.node;
    nodes.set(handle, {
      ...found,
      base: { x: n.x ?? 0, y: n.y ?? 0, rotation: n.rotation, scaleX: n.scaleX, scaleY: n.scaleY },
    });
  }
  const measured = new Map<string, Target>();
  for (const [role, entry] of Object.entries(extraBones)) {
    const found = find(entry.name, entry.kind);
    if (found) measured.set(role, found.node);
  }
  for (const [handle, name] of Object.entries(manifest.nodes)) {
    const entry = nodes.get(handle);
    if (entry && name) measured.set(handle, entry.node);
  }
  const boundsRaw = meta(board, 'bounds') as AABB;
  const bounds = {
    minX: Number(meta(boundsRaw, 'minX')),
    minY: Number(meta(boundsRaw, 'minY')),
    maxX: Number(meta(boundsRaw, 'maxX')),
    maxY: Number(meta(boundsRaw, 'maxY')),
  };
  const matrix = new runtime.Mat2D();
  let ratio = Math.min(devicePixelRatio || 1, 2);
  // Artboard -> CSS px of the last draw (for overlays).
  let view = { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 };

  function apply(handle: string, position: number, mix: number) {
    const name = manifest.tracks[handle];
    const clip = name ? clips.get(name) : undefined;
    if (!clip || mix <= 0) return;
    const seconds = Math.min(0.999, Math.max(0, position)) * clip.duration;
    clip.instance.advance(seconds - clip.t);
    clip.t = seconds;
    clip.instance.apply(Math.min(1, mix));
  }
  function applyClipByName(name: string, seconds: number, mix: number) {
    const clip = clips.get(name);
    if (!clip || mix <= 0) return;
    const s = Math.min(clip.duration, Math.max(0, seconds));
    clip.instance.advance(s - clip.t);
    clip.t = s;
    clip.instance.apply(Math.min(1, mix));
  }

  function pose(
    values: Partial<Pose>,
    extraClips: { role: string; time: number; mix: number }[] = [],
  ) {
    const p = { ...neutralPose(), ...values };
    const frame: MotionFrame = {
      time: 0,
      pose: p,
      clips: extraClips,
      placement: {
        x: 0,
        y: 0,
        lean: 0,
        facing: 1,
        scaleX: 1,
        scaleY: 1,
        opacity: 1,
        clipBelow: null,
      },
      shadow: { x: 0, y: 0, scale: 1, opacity: 0 },
      status: {
        airborne: 0,
        expressions: [],
        locomotion: 'idle',
        choreography: null,
        fidget: null,
        hidden: false,
      },
    };
    const bound = rig!.bind(frame);
    for (const entry of nodes.values()) {
      if (entry.positioned) {
        entry.node.x = entry.base.x;
        entry.node.y = entry.base.y;
      }
      entry.node.rotation = entry.base.rotation;
      entry.node.scaleX = entry.base.scaleX;
      entry.node.scaleY = entry.base.scaleY;
    }
    for (const sample of manifest.rest) apply(sample.track, sample.at ?? 0, sample.mix);
    for (const sample of bound.tracks) apply(sample.track, sample.time, sample.mix);
    for (const definition of Object.values(manifest.appearance)) {
      const option = definition.options.find((o) => o.id === definition.default);
      if (option) apply(option.track, 0, 1);
    }
    for (const [handle, offset] of Object.entries(bound.nodes)) {
      const entry = nodes.get(handle);
      if (!entry || !offset) continue;
      if (entry.positioned) {
        entry.node.x = (entry.node.x ?? 0) + (offset.x ?? 0);
        entry.node.y = (entry.node.y ?? 0) + (offset.y ?? 0);
      }
      entry.node.rotation += offset.rotation ?? 0;
      entry.node.scaleX *= offset.scaleX ?? 1;
      entry.node.scaleY *= offset.scaleY ?? 1;
    }
    // Two advances settle IK and constraints for a still frame.
    board.advance(0);
    board.advance(0);
  }

  /** Soles in artboard units (y down). */
  const soleY = bounds.maxY - manifest.soleOffset * (bounds.maxY - bounds.minY);
  const centreX = (bounds.minX + bounds.maxX) / 2;
  const units = bounds.maxY - bounds.minY;

  function draw(at: Draw) {
    const s = at.bodyPx / units;
    const sx = (at.scaleX ?? 1) * at.facing * s,
      sy = (at.scaleY ?? 1) * s;
    const r = (at.rotation * Math.PI) / 180;
    const cos = Math.cos(r),
      sin = Math.sin(r);
    // Artboard point p -> CSS: T(soles) R(r) S(sx, sy) T(-centre, -sole)
    const a = cos * sx,
      b = sin * sx,
      c = -sin * sy,
      d = cos * sy;
    const tx = at.x - (a * centreX + c * soleY),
      ty = at.y - (b * centreX + d * soleY);
    view = { a, b, c, d, tx, ty };
    matrix.xx = a * ratio;
    matrix.xy = b * ratio;
    matrix.yx = c * ratio;
    matrix.yy = d * ratio;
    matrix.tx = tx * ratio;
    matrix.ty = ty * ratio;
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    renderer.clear();
    renderer.save();
    renderer.transform(matrix);
    board.draw(renderer);
    renderer.restore();
    renderer.flush();
    runtime.resolveAnimationFrame();
  }

  function toView(x: number, y: number) {
    return { x: view.a * x + view.c * y + view.tx, y: view.b * x + view.d * y + view.ty };
  }
  /** World transform of a role in artboard units: origin and the tip of a bone (if a bone). */
  function world(role: string) {
    const node = measured.get(role);
    if (!node) return null;
    const m = node.worldTransform();
    const length = Number((node as unknown as { length?: number }).length ?? 0);
    const origin = { x: m.tx, y: m.ty };
    const tip = { x: m.tx + m.xx * length, y: m.ty + m.xy * length };
    m.delete?.();
    return { origin, tip, length };
  }
  /** Artboard units -> rest space (body heights from the soles' centre, +y up). */
  function toRest(p: { x: number; y: number }) {
    return { x: (p.x - centreX) / units, y: (soleY - p.y) / units };
  }

  return {
    manifest,
    roles: [...measured.keys()],
    bounds,
    resize(width: number, height: number) {
      ratio = Math.min(devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      canvas.style.width = `${String(width)}px`;
      canvas.style.height = `${String(height)}px`;
    },
    pose,
    draw,
    world,
    toRest,
    toView,
    clipNames: [...clips.keys()],
    applyClipByName,
  };
}
export type Puppet = Awaited<ReturnType<typeof createPuppet>>;
