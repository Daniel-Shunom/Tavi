import type { Artboard, Mat2D } from '@rive-app/webgl2/rive_advanced.mjs';
import { fromMat, type Affine } from '../../attachments/layer';
import type { Placement } from '../../adapter';
import { SkirtSwing } from './cloth';
import { liftedKnee, walkingKnees, requiredItem, SHIN, THIGH, type Point } from './legs';
type Joint = {
  x: number;
  y: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
  worldTransform(): Mat2D;
};
function matrix(node: Joint): Affine {
  const m = node.worldTransform();
  const a = fromMat(m);
  m.delete();
  return a;
}
function origin(n: Joint): Point {
  const m = matrix(n);
  return [m[4], m[5]];
}
function local(m: Affine, p: Point): Point {
  const d = m[0] * m[3] - m[1] * m[2],
    x = p[0] - m[4],
    y = p[1] - m[5];
  return [(m[3] * x - m[2] * y) / d, (-m[1] * x + m[0] * y) / d];
}
export function createRefinedPostprocessor(board: Artboard) {
  function node(name: string, bone = false): Joint {
    const result = (bone ? board.rootBone(name) : board.node(name)) as unknown as Joint | null;
    if (!result) throw new Error('Refined rig is missing ' + name);
    return result;
  }
  const mode = node('tavi/runtime/mode'),
    body = node('tavi/body'),
    pelvis = node('tavi/runtime/pelvis');
  const cloth = node('tavi/cloth/pelvis', true),
    swing = new SkirtSwing();
  const hips = [node('tavi/runtime/hipL', true), node('tavi/runtime/hipR', true)];
  const feet = [node('tavi/footL'), node('tavi/footR')];
  const upper = [node('tavi/runtime/legL.upper', true), node('tavi/runtime/legR.upper', true)];
  const shin = [node('tavi/runtime/legL.shin', true), node('tavi/runtime/legR.shin', true)];
  const nativeKnees = ['tavi/runtime/nativeKneeL', 'tavi/runtime/nativeKneeR'].map((name) => {
    const bone = board.bone(name) as unknown as Joint | null;
    if (!bone) throw new Error('Refined rig is missing ' + name);
    return bone;
  });
  return {
    update(dt = 0, placement?: Placement, travel?: number) {
      // Seated lap shapes own the garment; sitting weight fades the swing out.
      const seated = mode.x > 5.5 && mode.x < 8.5 && Math.abs(mode.x - 7) > 0.5;
      // Pages that move the character themselves report its travel; otherwise use placement.
      const world =
        travel ?? (placement && placement.height > 0 ? placement.x / placement.height : 0);
      cloth.rotation = swing.update(
        dt,
        world + origin(pelvis)[0] / 600,
        seated ? 1 - Math.max(0, Math.min(1, mode.rotation)) : 1,
      );
      // Foundation clips already contain the reviewed weighted limb projection.
      if (mode.x > 5.5 && mode.x < 6.5) {
        board.advance(0);
        return;
      }
      let h = hips.map(origin),
        f = feet.map(origin),
        knees: Point[] | null = null;
      // Expressive body accents cannot stretch a grounded physical leg. Settling
      // the hips preserves the planted target while the face/arms keep acting.
      if (mode.x < 1.5)
        for (let attempt = 0; attempt < 12; attempt++) {
          const excess = Math.max(
            ...h.map(
              (p, i) =>
                Math.hypot(requiredItem(f, i)[0] - p[0], requiredItem(f, i)[1] - p[1]) -
                (THIGH + SHIN - 0.5),
            ),
          );
          knees = mode.x < 0.5 ? walkingKnees(h, f) : null;
          if (excess <= 0 && (mode.x >= 0.5 || knees)) break;
          body.y += Math.max(2, excess + 0.5);
          board.advance(0);
          h = hips.map(origin);
          f = feet.map(origin);
        }
      if (mode.x > 7.5 && mode.x < 8.5) knees = nativeKnees.map(origin);
      else if (mode.x > 4.5 && mode.x < 5.5) {
        // Expressions retain the original rig's IK acting and bend direction.
        // Blend at the envelope boundary; the walking policy stays independent.
        const base = walkingKnees(h, f) ?? h.map((p, i) => liftedKnee(p, requiredItem(f, i)));
        const weight = Math.max(0, Math.min(1, mode.rotation));
        knees = nativeKnees.map((node, i) => {
          const k = origin(node),
            a = requiredItem(base, i);
          return [a[0] + (k[0] - a[0]) * weight, a[1] + (k[1] - a[1]) * weight];
        });
      } else if (mode.x > 2.5 && mode.x < 3.5) {
        const center = (requiredItem(h, 0)[0] + requiredItem(h, 1)[0]) / 2;
        const weight = Math.max(0, Math.min(1, mode.rotation));
        knees = h.map((p, i) => {
          const base = liftedKnee(p, requiredItem(f, i));
          return [
            base[0] + (center + (i === 0 ? -50 : 50) - base[0]) * weight,
            base[1] + (p[1] + 4 - base[1]) * weight,
          ];
        });
      } else if (mode.x > 1.5 && mode.x < 2.5) knees = f.map((p) => [p[0], p[1] - SHIN]);
      else knees ??= h.map((p, i) => liftedKnee(p, requiredItem(f, i)));
      const parent = matrix(pelvis);
      for (let i = 0; i < 2; i++)
        for (const [target, start, end, length] of [
          [requiredItem(upper, i), requiredItem(h, i), requiredItem(knees, i), THIGH],
          [requiredItem(shin, i), requiredItem(knees, i), requiredItem(f, i), SHIN],
        ] as const) {
          const a = local(parent, start),
            b = local(parent, end),
            dx = b[0] - a[0],
            dy = b[1] - a[1];
          target.x = a[0];
          target.y = a[1];
          target.rotation = Math.atan2(dy, dx);
          target.scaleX = Math.hypot(dx, dy) / length;
          target.scaleY = 1;
        }
      board.advance(0);
    },
  };
}
