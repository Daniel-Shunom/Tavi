import type { Artboard, Mat2D } from '@rive-app/webgl2/rive_advanced.mjs';
import { fromMat, type Affine } from '../../attachments/layer';
import type { Placement } from '../../adapter';
import { SkirtSwing } from './cloth';
import { FollowThrough } from '../../rig/spring';
import { projectSupport, solveLimb, softReach, distance } from '../../rig/geometry';
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
export function createRefinedPostprocessor(board: Artboard, foundation = false) {
  function node(name: string, bone = false): Joint {
    const result = (bone ? board.rootBone(name) : board.node(name)) as unknown as Joint | null;
    if (!result) throw new Error('Refined rig is missing ' + name);
    return result;
  }
  const mode = node('tavi/runtime/mode'),
    body = node('tavi/body'),
    pelvis = node('tavi/runtime/pelvis');
  const cloth = node('tavi/cloth/pelvis', true),
    swing = foundation ? new FollowThrough() : new SkirtSwing();
  const hips = [node('tavi/runtime/hipL', true), node('tavi/runtime/hipR', true)];
  const feet = [node('tavi/footL'), node('tavi/footR')];
  const upper = [node('tavi/runtime/legL.upper', true), node('tavi/runtime/legR.upper', true)];
  const shin = [node('tavi/runtime/legL.shin', true), node('tavi/runtime/legR.shin', true)];
  const nativeKnees = ['tavi/runtime/nativeKneeL', 'tavi/runtime/nativeKneeR'].map((name) => {
    const bone = board.bone(name) as unknown as Joint | null;
    if (!bone) throw new Error('Refined rig is missing ' + name);
    return bone;
  });
  // Calibrate bend branches from the bind pose once. Deriving the sign from a
  // moving target would flip a knee when its target crosses the hip's vertical.
  if (foundation) board.advance(0);
  const bends: (-1 | 1)[] = foundation
    ? hips.map((hip, i) => {
        const h = origin(hip),
          f = origin(requiredItem(feet, i)),
          k = origin(requiredItem(nativeKnees, i));
        return (f[0] - h[0]) * (k[1] - h[1]) - (f[1] - h[1]) * (k[0] - h[0]) < 0 ? -1 : 1;
      })
    : [];
  let diagnostics = { owner: 'authored', contactError: 0, lengthError: 0, supportResidual: 0 };
  return {
    diagnostics: () => diagnostics,
    update(dt = 0, placement?: Placement, travel?: number) {
      const rigidLegs = foundation && (mode.x < 1.5 || (mode.x > 3.5 && mode.x < 4.5));
      diagnostics = {
        owner: rigidLegs ? 'contact-solver' : 'authored',
        contactError: 0,
        lengthError: 0,
        supportResidual: 0,
      };
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
      if (mode.x < 1.5 && !foundation)
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
      if (foundation && mode.x < 1.5) {
        // Solve in pelvis units so character/stage scale cannot stretch the bones.
        const parent = matrix(pelvis);
        const roots = h.map((p) => local(parent, p)),
          targets = f.map((p) => local(parent, p));
        const support = projectSupport(
          roots.map((root, i) => ({
            root,
            target: requiredItem(targets, i),
            reach: Math.max(
              0.001,
              softReach(distance(root, requiredItem(targets, i)), THIGH + SHIN, 8),
            ),
          })),
        );
        diagnostics.supportResidual = support.residual;
        const [sx, sy] = support.offset;
        const wx = parent[0] * sx + parent[2] * sy,
          wy = parent[1] * sx + parent[3] * sy;
        // Recover the body's parent linear transform: world = parent * local.
        const bm = matrix(body),
          c = Math.cos(body.rotation),
          s = Math.sin(body.rotation);
        const a = (bm[0] * c) / body.scaleX - (bm[2] * s) / body.scaleY;
        const b = (bm[1] * c) / body.scaleX - (bm[3] * s) / body.scaleY;
        const c2 = (bm[0] * s) / body.scaleX + (bm[2] * c) / body.scaleY;
        const d = (bm[1] * s) / body.scaleX + (bm[3] * c) / body.scaleY;
        const determinant = a * d - b * c2;
        if (Math.abs(determinant) > 1e-8) {
          body.x += (d * wx - c2 * wy) / determinant;
          body.y += (-b * wx + a * wy) / determinant;
        }
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
      if (rigidLegs) {
        // Authored gaits, seated poses and acting keep their own weighted projection.
        knees = h.map((hip, i) => {
          const root = local(parent, hip),
            target = local(parent, requiredItem(f, i));
          const solved = solveLimb(root, target, THIGH, SHIN, requiredItem(bends, i));
          // Incompatible/folded targets keep rigid lengths and expose contact
          // error instead of silently stretching the shin to the requested foot.
          f[i] = [
            parent[0] * solved.end[0] + parent[2] * solved.end[1] + parent[4],
            parent[1] * solved.end[0] + parent[3] * solved.end[1] + parent[5],
          ];
          const [x, y] = solved.joint;
          return [
            parent[0] * x + parent[2] * y + parent[4],
            parent[1] * x + parent[3] * y + parent[5],
          ];
        });
      }
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
      if (rigidLegs) {
        const inverse = matrix(pelvis);
        for (let i = 0; i < 2; i++) {
          const upperJoint = requiredItem(upper, i),
            lowerJoint = requiredItem(shin, i);
          const lowerMatrix = matrix(lowerJoint);
          const endpoint: Point = [
            lowerMatrix[4] + lowerMatrix[0] * SHIN,
            lowerMatrix[5] + lowerMatrix[1] * SHIN,
          ];
          diagnostics.contactError = Math.max(
            diagnostics.contactError,
            distance(local(inverse, endpoint), local(inverse, origin(requiredItem(feet, i)))),
          );
          diagnostics.lengthError = Math.max(
            diagnostics.lengthError,
            Math.abs(upperJoint.scaleX - 1) * THIGH,
            Math.abs(lowerJoint.scaleX - 1) * SHIN,
          );
        }
      }
    },
  };
}
