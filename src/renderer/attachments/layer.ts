// Draws equipped attachments on two Canvas2D layers stacked behind and in front of the Rive
// canvas. Each slot follows a named rig component's world transform every frame, so items move
// with idle, walking, gestures and entrances; dangly layers swing on angular springs.
import { shade } from './color';
import type {
  AttachmentSpec,
  AttachmentTints,
  CharacterSlots,
  EquippedAttachments,
  Paint,
  SlotBinding,
  SlotId,
  Spring,
} from './schema';

/** Affine matrix in canvas order: x' = a*x + c*y + e, y' = b*x + d*y + f. */
export type Affine = readonly [number, number, number, number, number, number];
export const IDENTITY: Affine = [1, 0, 0, 1, 0, 0];

export function multiply(m: Affine, n: Affine): Affine {
  return [
    m[0] * n[0] + m[2] * n[1],
    m[1] * n[0] + m[3] * n[1],
    m[0] * n[2] + m[2] * n[3],
    m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4],
    m[1] * n[4] + m[3] * n[5] + m[5],
  ];
}
export const translate = (x: number, y: number): Affine => [1, 0, 0, 1, x, y];
export const scale = (x: number, y = x): Affine => [x, 0, 0, y, 0, 0];
export function rotate(radians: number): Affine {
  const c = Math.cos(radians),
    s = Math.sin(radians);
  return [c, s, -s, c, 0, 0];
}
export function apply(m: Affine, x: number, y: number): [number, number] {
  return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
}

/** Rive's Mat2D shape (xx, xy, yx, yy, tx, ty). */
export interface MatLike {
  xx: number;
  xy: number;
  yx: number;
  yy: number;
  tx: number;
  ty: number;
}
export const fromMat = (m: MatLike): Affine => [m.xx, m.xy, m.yx, m.yy, m.tx, m.ty];

/** Reads a component's world transform in artboard space, or null when it does not exist. */
export type TransformSource = (binding: SlotBinding) => Affine | null;

export interface SlotFrame {
  /** Slot space -> artboard space. Unit length = the slot's reference size. */
  matrix: Affine;
  origin: [number, number];
  rotation: number;
}

/** Resolves a slot's frame in artboard space from its binding and the node's world transform. */
export function slotFrame(binding: SlotBinding, world: Affine | null): SlotFrame {
  const node = world ?? IDENTITY;
  const origin = apply(node, binding.offset[0], binding.offset[1]);
  const nodeRotation = Math.atan2(node[1], node[0]);
  const sx = Math.hypot(node[0], node[1]) || 1,
    sy = Math.hypot(node[2], node[3]) || 1;
  const rotation = nodeRotation * binding.follow + (binding.rotation * Math.PI) / 180;
  const matrix = multiply(
    multiply(translate(origin[0], origin[1]), rotate(rotation)),
    scale(binding.size * sx, binding.size * sy),
  );
  return { matrix, origin, rotation };
}

/** Item space -> slot space. */
export function itemMatrix(spec: AttachmentSpec): Affine {
  const k = spec.size / spec.viewBox[2];
  return multiply(
    multiply(
      multiply(translate(spec.offset[0], spec.offset[1]), rotate((spec.rotation * Math.PI) / 180)),
      scale(k),
    ),
    translate(-spec.anchor[0], -spec.anchor[1]),
  );
}

export interface Palette {
  hair?: string;
  outfit?: string;
  glasses?: string;
  skin?: string;
}

export function resolveTint(
  spec: AttachmentSpec,
  name: string,
  tints: AttachmentTints,
  palette: Palette,
): string {
  const override = tints[spec.id]?.[name];
  if (override) return override;
  const tint = spec.tints[name];
  if (!tint) return '#ff00ff';
  const followed = tint.follow ? palette[tint.follow] : undefined;
  return followed ?? tint.default;
}

export function resolvePaint(
  paint: Paint,
  spec: AttachmentSpec,
  tints: AttachmentTints,
  palette: Palette,
): string {
  if (typeof paint === 'string') return paint;
  const color = shade(resolveTint(spec, paint.tint, tints, palette), paint.shade);
  if (paint.alpha >= 1) return color;
  const a = Math.round(paint.alpha * 255)
    .toString(16)
    .padStart(2, '0');
  return color + a;
}

/** Damped angular spring driven by slot acceleration and tilt. */
export class SwingState {
  angle = 0;
  velocity = 0;
  private last: { x: number; y: number; vx: number; vy: number } | null = null;
  /** `origin` is the slot origin in stage space measured in artboard units, so stage moves count. */
  step(spring: Spring, frame: SlotFrame, origin: readonly [number, number], dt: number) {
    if (dt <= 0) return this.angle;
    const [x, y] = origin;
    const vx = this.last ? (x - this.last.x) / dt : 0,
      vy = this.last ? (y - this.last.y) / dt : 0;
    const ax = this.last ? (vx - this.last.vx) / dt : 0,
      ay = this.last ? (vy - this.last.vy) / dt : 0;
    this.last = { x, y, vx, vy };
    // Acceleration in the slot's local frame; sideways acceleration swings the layer backward.
    const c = Math.cos(-frame.rotation),
      s = Math.sin(-frame.rotation);
    const localAx = ax * c - ay * s;
    const max = (spring.maxAngle * Math.PI) / 180;
    const rest = -frame.rotation * spring.hang;
    const steps = Math.max(1, Math.ceil(dt / (1 / 120)));
    const h = dt / steps;
    for (let i = 0; i < steps; i++) {
      const force =
        -spring.stiffness * (this.angle - rest) -
        spring.damping * this.velocity -
        localAx * spring.inertia;
      this.velocity += force * h;
      this.angle = Math.max(-max, Math.min(max, this.angle + this.velocity * h));
    }
    return this.angle;
  }
}

export interface PathFactory {
  (d: string): unknown;
}

export interface Canvas2D {
  save(): void;
  restore(): void;
  setTransform(a: number, b: number, c: number, d: number, e: number, f: number): void;
  fillStyle: unknown;
  strokeStyle: unknown;
  lineWidth: number;
  lineJoin: unknown;
  lineCap: unknown;
  fill(path: never, rule?: 'nonzero' | 'evenodd'): void;
  stroke(path: never): void;
}

export interface DrawInput {
  /** Artboard space -> canvas pixels (the same alignment the Rive renderer uses). */
  view: Affine;
  world: TransformSource;
  equipped: EquippedAttachments;
  tints?: AttachmentTints;
  palette?: Palette;
  dt: number;
  /** Disable springs (reduced motion). */
  still?: boolean;
}

/** Draw order between slots: back-of-head first, hands last. */
const SLOT_ORDER: readonly SlotId[] = [
  'head.back',
  'torso',
  'neck',
  'head.side',
  'head.top',
  'head.face',
  'hand.l',
  'hand.r',
];

export function createAttachmentLayer(options: {
  slots: CharacterSlots;
  items: ReadonlyMap<string, AttachmentSpec>;
  path: PathFactory;
}) {
  const paths = new Map<string, unknown>();
  const swings = new Map<string, SwingState>();
  const pathFor = (d: string) => {
    let path = paths.get(d);
    if (!path) paths.set(d, (path = options.path(d)));
    return path;
  };
  function draw(back: Canvas2D | null, front: Canvas2D, input: DrawInput) {
    const tints = input.tints ?? {},
      palette = input.palette ?? {};
    for (const slot of SLOT_ORDER) {
      const id = input.equipped[slot];
      const binding = options.slots[slot];
      const spec = id ? options.items.get(id) : undefined;
      if (!binding || !spec) continue;
      const frame = slotFrame(binding, input.world(binding));
      const base = multiply(multiply(input.view, frame.matrix), itemMatrix(spec));
      const angles = new Map<string, number>();
      const viewScale = Math.hypot(input.view[0], input.view[1]) || 1;
      const stage = apply(input.view, frame.origin[0], frame.origin[1]);
      const origin = [stage[0] / viewScale, stage[1] / viewScale] as const;
      for (const [group, spring] of Object.entries(spec.springs)) {
        const key = slot + '/' + spec.id + '/' + group;
        let swing = swings.get(key);
        if (!swing) swings.set(key, (swing = new SwingState()));
        angles.set(group, input.still ? 0 : swing.step(spring, frame, origin, input.dt));
      }
      for (const layer of spec.layers) {
        const ctx = layer.behind ? back : front;
        if (!ctx) continue;
        let matrix = base;
        const spring = layer.spring ? spec.springs[layer.spring] : undefined;
        if (spring && layer.spring) {
          const [px, py] = spring.pivot;
          matrix = multiply(
            matrix,
            multiply(
              multiply(translate(px, py), rotate(angles.get(layer.spring) ?? 0)),
              translate(-px, -py),
            ),
          );
        }
        ctx.save();
        ctx.setTransform(...matrix);
        const path = pathFor(layer.d) as never;
        if (layer.fill) {
          ctx.fillStyle = resolvePaint(layer.fill, spec, tints, palette);
          ctx.fill(path, layer.evenOdd ? 'evenodd' : 'nonzero');
        }
        if (layer.stroke) {
          ctx.strokeStyle = resolvePaint(layer.stroke, spec, tints, palette);
          ctx.lineWidth = layer.strokeWidth ?? 2;
          ctx.lineJoin = 'round';
          ctx.lineCap = 'round';
          ctx.stroke(path);
        }
        ctx.restore();
      }
    }
  }
  return {
    draw,
    reset() {
      swings.clear();
    },
  };
}
export type AttachmentLayer = ReturnType<typeof createAttachmentLayer>;
