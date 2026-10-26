// Draws a variant's shape set on the attachment canvases behind and in front of the character.
// Head-space layers follow their anchor's motion relative to the first frame the layer sees
// (the rest pose at load), so a lock on `hair left swing` moves exactly as that bone does;
// anchor-space layers (forearm features) use the anchor's world transform directly.
import {
  IDENTITY,
  SwingState,
  apply,
  multiply,
  rotate,
  translate,
  type Affine,
  type Canvas2D,
  type PathFactory,
  type TransformSource,
} from '../../../attachments/layer';
import type { Variant } from '../../../../../shared/variants';
import type { OverlayAnchor, VariantRig } from '../rig';
import { overlayPalette, variantShapes } from './compose';
import type { Paint, PaintSlot } from './types';

function invert(m: Affine): Affine {
  const det = m[0] * m[3] - m[1] * m[2] || 1;
  const a = m[3] / det,
    b = -m[1] / det,
    c = -m[2] / det,
    d = m[0] / det;
  return [a, b, c, d, -(a * m[4] + c * m[5]), -(b * m[4] + d * m[5])];
}

function color(paint: Paint, palette: Record<PaintSlot, string>) {
  const hex = palette[paint.slot];
  const alpha = paint.alpha ?? 1;
  if (alpha >= 1) return hex;
  return (
    hex +
    Math.round(alpha * 255)
      .toString(16)
      .padStart(2, '0')
  );
}

export interface VariantLayerInput {
  /** Artboard -> canvas pixels (the renderer's alignment). */
  view: Affine;
  world: TransformSource;
  dt: number;
  still?: boolean;
}

export function createVariantLayer(options: {
  rig: VariantRig;
  variant: Variant;
  path: PathFactory;
}) {
  const { rig } = options;
  const shapes = variantShapes(options.variant);
  const palette = overlayPalette(options.variant);
  const paths = new Map<string, unknown>();
  const pathFor = (d: string) => {
    let path = paths.get(d);
    if (!path) paths.set(d, (path = options.path(d)));
    return path as never;
  };
  const swings = new Map<string, SwingState>();
  /** anchor -> (anchor space <- head space) captured at the first frame. */
  let rest: Partial<Record<OverlayAnchor, Affine>> | null = null;
  const anchorWorld = (world: TransformSource, anchor: OverlayAnchor): Affine | null => {
    const binding = rig.anchors[anchor];
    return world({
      node: binding.name,
      kind: binding.kind,
      offset: [0, 0],
      size: 1,
      follow: 1,
      rotation: 0,
    });
  };

  function draw(back: Canvas2D | null, front: Canvas2D, input: VariantLayerInput) {
    if (!shapes.layers.length) return;
    const now = new Map<OverlayAnchor, Affine | null>();
    const worldOf = (anchor: OverlayAnchor) => {
      if (!now.has(anchor)) now.set(anchor, anchorWorld(input.world, anchor));
      return now.get(anchor) ?? null;
    };
    const head = worldOf('head');
    if (!head) return;
    if (!rest) {
      rest = {};
      for (const anchor of Object.keys(rig.anchors) as OverlayAnchor[]) {
        const w = worldOf(anchor);
        if (w) rest[anchor] = multiply(invert(w), head);
      }
    }
    const viewScale = Math.hypot(input.view[0], input.view[1]) || 1;
    const angles = new Map<string, number>();
    for (const [name, spring] of Object.entries(shapes.springs ?? {})) {
      const owner = shapes.layers.find((layer) => layer.spring === name);
      const anchor = owner?.follow ?? 'head';
      const w = worldOf(anchor);
      const local = rest[anchor];
      const m = w && local ? multiply(w, local) : head;
      const pivot = apply(m, spring.pivot[0], spring.pivot[1]);
      const stage = apply(input.view, pivot[0], pivot[1]);
      let swing = swings.get(name);
      if (!swing) swings.set(name, (swing = new SwingState()));
      const frame = { matrix: IDENTITY, origin: pivot, rotation: Math.atan2(m[1], m[0]) };
      angles.set(
        name,
        input.still
          ? 0
          : swing.step(spring, frame, [stage[0] / viewScale, stage[1] / viewScale], input.dt),
      );
    }
    for (const layer of shapes.layers) {
      const ctx = layer.behind ? back : front;
      if (!ctx) continue;
      const anchor = layer.follow ?? 'head';
      const w = worldOf(anchor);
      let m: Affine;
      if (layer.space === 'anchor') {
        if (!w) continue;
        m = w;
      } else {
        const local = rest[anchor];
        m = w && local ? multiply(w, local) : head;
      }
      const spring = layer.spring ? shapes.springs?.[layer.spring] : undefined;
      if (spring && layer.spring) {
        const [px, py] = spring.pivot;
        m = multiply(
          m,
          multiply(
            multiply(translate(px, py), rotate(angles.get(layer.spring) ?? 0)),
            translate(-px, -py),
          ),
        );
      }
      ctx.save();
      ctx.setTransform(...multiply(input.view, m));
      if (layer.fill) {
        ctx.fillStyle = color(layer.fill, palette);
        ctx.fill(pathFor(layer.d), layer.evenOdd ? 'evenodd' : 'nonzero');
      }
      if (layer.stroke) {
        ctx.strokeStyle = color(layer.stroke, palette);
        ctx.lineWidth = layer.stroke.width;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.stroke(pathFor(layer.d));
      }
      ctx.restore();
    }
  }
  return {
    draw,
    /** Forget spring state (teleports). */
    reset() {
      swings.clear();
    },
    /** Also forget the captured rest pose; the next frame must be the rest pose. */
    recapture() {
      swings.clear();
      rest = null;
    },
    get empty() {
      return shapes.layers.length === 0;
    },
  };
}
export type VariantLayer = ReturnType<typeof createVariantLayer>;
