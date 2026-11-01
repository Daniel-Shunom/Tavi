import { distance, solveLimb, type Vec2 } from './geometry';
import type { Affine } from '../attachments/layer';
export function transformPoint(m: Affine, p: Vec2): Vec2 {
  return [m[0] * p[0] + m[2] * p[1] + m[4], m[1] * p[0] + m[3] * p[1] + m[5]];
}
export function inversePoint(m: Affine, p: Vec2): Vec2 {
  const determinant = m[0] * m[3] - m[1] * m[2];
  if (!Number.isFinite(determinant) || Math.abs(determinant) < 1e-10)
    throw new Error('Singular contact parent.');
  const x = p[0] - m[4],
    y = p[1] - m[5];
  return [(m[3] * x - m[2] * y) / determinant, (-m[1] * x + m[0] * y) / determinant];
}
export const angleDelta = (from: number, to: number) =>
  Math.atan2(Math.sin(to - from), Math.cos(to - from));
/** Match the closest FK elbow before blending to IK, including mirrored parents.
 * At full weight the target is fixed; unreachable targets expose their residual.
 */
export function solveContact(root: Vec2, target: Vec2, elbow: Vec2, upper: number, lower: number) {
  const a = solveLimb(root, target, upper, lower, -1),
    b = solveLimb(root, target, upper, lower, 1);
  const solution = distance(a.joint, elbow) <= distance(b.joint, elbow) ? a : b;
  const upperAngle = Math.atan2(solution.joint[1] - root[1], solution.joint[0] - root[0]);
  const lowerAngle = Math.atan2(
    solution.end[1] - solution.joint[1],
    solution.end[0] - solution.joint[0],
  );
  return { ...solution, upperAngle, lowerAngle: angleDelta(upperAngle, lowerAngle) };
}
