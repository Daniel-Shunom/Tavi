import type { Vec2 } from './geometry';

/** Independent additive angles in radians; stabilization is 0..1 world-upright compensation. */
export interface BodyControls {
  pelvisTilt?: number;
  chestTilt?: number;
  neckTilt?: number;
  headTilt?: number;
  headStabilize?: number;
  /** Translation lock to the sampled support pose; weights 0..1. */
  headSupport?: number;
  /** Character-specific sleeping wrist contacts; weight 0..1. */
  sleepSupport?: number;
  propSupport?: number;
}
export const bodyLimits = {
  pelvisTilt: 0.08,
  chestTilt: 0.12,
  neckTilt: 0.1,
  headTilt: 0.18,
  headStabilize: 1,
  headSupport: 1,
  sleepSupport: 1,
  propSupport: 1,
} as const;
export interface BodyTransform {
  x: number;
  y: number;
  rotation: number;
}
export interface BodyParts {
  /** Direct siblings in their existing paint order; exclude pelvis. Include head/neck/collar. */
  chest: readonly BodyTransform[];
  pelvis: BodyTransform;
  head: BodyTransform;
  neck: BodyTransform;
  collar: BodyTransform;
}
export function boundedBody(controls: BodyControls = {}): Required<BodyControls> {
  const read = (key: keyof BodyControls) => {
    const value = controls[key] ?? 0;
    if (!Number.isFinite(value)) throw new Error('Non-finite body control: ' + key);
    return Math.max(
      key === 'headStabilize' ||
        key === 'headSupport' ||
        key === 'sleepSupport' ||
        key === 'propSupport'
        ? 0
        : -bodyLimits[key],
      Math.min(bodyLimits[key], value),
    );
  };
  return {
    pelvisTilt: read('pelvisTilt'),
    chestTilt: read('chestTilt'),
    neckTilt: read('neckTilt'),
    headTilt: read('headTilt'),
    headStabilize: read('headStabilize'),
    headSupport: read('headSupport'),
    sleepSupport: read('sleepSupport'),
    propSupport: read('propSupport'),
  };
}
export function rotatePart(part: BodyTransform, pivot: Vec2, angle: number) {
  if (angle === 0) return;
  const dx = part.x - pivot[0],
    dy = part.y - pivot[1],
    c = Math.cos(angle),
    s = Math.sin(angle);
  part.x = pivot[0] + c * dx - s * dy;
  part.y = pivot[1] + s * dx + c * dy;
  part.rotation += angle;
}
/** Virtual parent: equivalent sibling transforms without changing draw order or bind IDs.
 * prepare() MUST run before animation/rest samples; apply() runs after them, before contacts.
 */
export class BodyRig {
  private saved: { part: BodyTransform; x: number; y: number; rotation: number }[] | null = null;
  constructor(private readonly parts: BodyParts) {
    if (
      !parts.chest.includes(parts.head) ||
      !parts.chest.includes(parts.neck) ||
      !parts.chest.includes(parts.collar) ||
      parts.chest.includes(parts.pelvis)
    )
      throw new Error('Invalid body decomposition.');
    if (new Set(parts.chest).size !== parts.chest.length)
      throw new Error('Duplicate chest component.');
  }
  private restore() {
    for (const { part, x, y, rotation } of this.saved ?? []) {
      part.x = x;
      part.y = y;
      part.rotation = rotation;
    }
  }
  prepare() {
    this.restore();
    this.saved = null;
  }
  apply(input: BodyControls = {}) {
    const controls = boundedBody(input);
    if (this.saved) this.restore();
    else
      this.saved = [...this.parts.chest, this.parts.pelvis].map((part) => ({
        part,
        x: part.x,
        y: part.y,
        rotation: part.rotation,
      }));
    const { pelvis, head, neck, collar, chest } = this.parts;
    const headRest: Vec2 = [head.x, head.y];
    const waist: Vec2 = [pelvis.x, pelvis.y];
    for (const part of chest) rotatePart(part, waist, controls.chestTilt);
    pelvis.rotation += controls.pelvisTilt;
    const neckPivot: Vec2 = [collar.x, collar.y];
    rotatePart(head, neckPivot, controls.neckTilt);
    rotatePart(neck, neckPivot, controls.neckTilt);
    head.rotation +=
      controls.headTilt - (controls.chestTilt + controls.neckTilt) * controls.headStabilize;
    head.x += (headRest[0] - head.x) * controls.headSupport;
    head.y += (headRest[1] - head.y) * controls.headSupport;
    return controls;
  }
}
