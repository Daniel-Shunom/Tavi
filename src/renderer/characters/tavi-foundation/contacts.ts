import type {
  Artboard,
  TransformComponent,
  Bone,
  RootBone,
} from '@rive-app/webgl2/rive_advanced.mjs';
import { fromMat, type Affine } from '../../attachments/layer';
import { inversePoint, transformPoint, solveContact, angleDelta } from '../../rig/contact';
import { distance, type Vec2 } from '../../rig/geometry';
function matrix(node: TransformComponent, parent = false): Affine {
  const m = node.worldTransform();
  if (parent) node.parentWorldTransform(m);
  const result = fromMat(m);
  m.delete();
  return result;
}
const origin = (node: TransformComponent): Vec2 => {
  const m = matrix(node);
  return [m[4], m[5]];
};
/** Wrist targets are calibrated to the existing art, never stage pixels.
 * No bone length, bind, scale, drawable or depth rule is modified.
 */
export function createSleepContacts(board: Artboard) {
  function bone(name: string, root = false) {
    const result = (root ? board.rootBone(name) : board.bone(name)) as Bone | null;
    if (!result) throw new Error('Sleep contact is missing ' + name);
    return result;
  }
  function node(name: string) {
    const result = board.node(name) as ReturnType<typeof board.node> | null;
    if (!result) throw new Error('Sleep contact is missing ' + name);
    return result;
  }
  const footL = node('tavi/footL'),
    footR = node('tavi/footR');
  const a = origin(footL),
    b = origin(footR);
  const floor: Vec2 = [300, Math.max(a[1], b[1])];
  const head = node('tavi/head'),
    shirt = node('shirt');
  const chains = [
    {
      upper: bone('tavi/armL.upper', true) as RootBone,
      fore: bone('tavi/armL.fore'),
      target: () => transformPoint(matrix(head), [-55, -32]),
    },
    {
      upper: bone('tavi/armR.upper', true) as RootBone,
      fore: bone('tavi/armR.fore'),
      target: () => transformPoint(matrix(shirt), [15, 30]),
    },
  ];
  let saved: { node: Bone; rotation: number }[] | null = null;
  let diagnostics = {
    weight: 0,
    propWeight: 0,
    groundError: 0,
    wristError: 0,
    reachError: 0,
    headAnchor: [0, 0] as Vec2,
  };
  return {
    prepare() {
      for (const s of saved ?? []) s.node.rotation = s.rotation;
      saved = null;
    },
    diagnostics: () => diagnostics,
    apply(weight: number, prop = 0, rotation = 0) {
      diagnostics = {
        weight,
        propWeight: prop,
        groundError: 0,
        wristError: 0,
        reachError: 0,
        headAnchor: origin(head),
      };
      if (saved) {
        for (const s of saved) s.node.rotation = s.rotation;
        board.advance(0);
      }
      if (weight + prop <= 0) {
        saved = null;
        return;
      }
      // Capture FK only after the animation and body articulation have been sampled.
      saved = chains.flatMap((c) =>
        [c.upper, c.fore].map((node) => ({ node, rotation: node.rotation })),
      );
      const targets: Vec2[] = [];
      const ground: Vec2 = [
        floor[0] - 48 * Math.cos((rotation * Math.PI) / 180),
        floor[1] + 48 * Math.sin((rotation * Math.PI) / 180),
      ];
      for (const [index, chain] of chains.entries()) {
        const { upper, fore } = chain;
        const parent = matrix(upper, true),
          restTarget = chain.target();
        const amount = index === 0 ? Math.min(1, weight + prop) : weight;
        const t = index === 0 && weight + prop > 0 ? prop / (weight + prop) : 0;
        const target: Vec2 = [
          restTarget[0] + (ground[0] - restTarget[0]) * t,
          restTarget[1] + (ground[1] - restTarget[1]) * t,
        ];
        targets.push(target);
        const solution = solveContact(
          [upper.x, upper.y],
          inversePoint(parent, target),
          inversePoint(parent, origin(fore)),
          upper.length * upper.scaleX,
          fore.length * fore.scaleX * upper.scaleX,
        );
        diagnostics.reachError = Math.max(diagnostics.reachError, solution.error);
        upper.rotation += angleDelta(upper.rotation, solution.upperAngle) * amount;
        fore.rotation += angleDelta(fore.rotation, solution.lowerAngle) * amount;
      }
      board.advance(0);
      for (const [i, chain] of chains.entries()) {
        const target = targets[i];
        if (!target) continue;
        const endpoint = transformPoint(matrix(chain.fore), [chain.fore.length, 0]);
        if (weight > 0)
          diagnostics.wristError = Math.max(diagnostics.wristError, distance(endpoint, target));
        if (i === 0 && prop > 0) diagnostics.groundError = distance(endpoint, target);
      }
    },
  };
}
