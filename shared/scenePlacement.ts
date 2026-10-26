import { bounds, clampPoint, type Point } from './locomotion.js';
import type { Scene, SceneRect } from './states.js';

/** Approximate standing footprint in normalized overlay coordinates. */
export interface CharacterFootprint {
  halfWidth: number;
  height: number;
}

/**
 * Move an ordinary landing point clear of enabled scene panels. This only chooses a safe
 * destination; locomotion still uses its existing direct path. Explicit anchors and body states
 * are intentionally handled by their own scene-aware placement rules.
 */
export function clearSceneLanding(
  target: Point,
  scene: Scene,
  footprint: CharacterFootprint,
): Point {
  const panels = [scene.webcam, scene.game, scene.chat].filter((rect) => rect.enabled);

  const collides = (point: Point, rect: SceneRect) => {
    const left = point.x - footprint.halfWidth;
    const right = point.x + footprint.halfWidth;
    const top = point.y - footprint.height;
    return right > rect.x && left < rect.x + rect.w && point.y > rect.y && top < rect.y + rect.h;
  };

  if (!panels.some((rect) => collides(target, rect))) return target;

  const xs = new Set<number>([target.x, bounds.minX, bounds.maxX]);
  const ys = new Set<number>([target.y, bounds.minY, bounds.maxY]);
  for (const rect of panels) {
    xs.add(rect.x - footprint.halfWidth);
    xs.add(rect.x + rect.w + footprint.halfWidth);
    ys.add(rect.y - 0.001);
    ys.add(rect.y + rect.h + footprint.height);
  }

  const candidates: Point[] = [];
  for (const x of xs) for (const y of ys) candidates.push(clampPoint({ x, y }));
  const clear = candidates.filter((candidate) =>
    panels.every((rect) => !collides(candidate, rect)),
  );
  if (!clear.length) return clampPoint(target);
  clear.sort((a, b) => {
    const da = (a.x - target.x) ** 2 + (a.y - target.y) ** 2;
    const db = (b.x - target.x) ** 2 + (b.y - target.y) ** 2;
    return da - db || a.x - b.x || a.y - b.y;
  });
  return clear[0] ?? clampPoint(target);
}
