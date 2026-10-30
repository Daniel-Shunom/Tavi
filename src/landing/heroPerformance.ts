import { walkCyclePx, type Measures, type Placement, type Rect, type Stage } from './choreography';

// TV 01's measured bounds, projected through the same glass used by CrtScene.
const glassHeight = 0.4042329 - 0.1141471;
const glassWidth = 0.1263319 - -0.2571352;
const smooth = (t: number) => {
  const u = Math.min(1, Math.max(0, t));
  return u * u * (3 - 2 * u);
};
const mix = (a: number, b: number, t: number) => a + (b - a) * smooth(t);

export type HeroDepth = 'front' | 'back';
export interface HeroFrame {
  placement: Placement;
  depth: HeroDepth | null;
  action: 'look' | null;
  /** Corresponding exit progress while Tavi is still inside the picture. */
  insideProgress: number | null;
  finished: boolean;
}

/** Keep peak speed within the distance the authored walk cycle can actually cover. */
export function heroTimings(m: Measures) {
  if (!m.screen || !m.cam) return null;
  const pxPerX = m.screen.width / glassWidth;
  const left = m.screen.left - (0.3 - 0.2571352) * pxPerX;
  const outsideLeft = left - m.bodyPx * 0.24;
  const camX = m.cam.left + m.cam.width / 2;
  const frontDuration = Math.max(
    3,
    (1.5 * Math.abs(camX - outsideLeft)) / Math.max(1, walkCyclePx(m.bodyPx) * 2.4),
  );
  const frontEnd = 5 + frontDuration;
  const lookEnd = frontEnd + 1.2;
  const backEnd = lookEnd + 6;
  return { frontDuration, frontEnd, lookEnd, backEnd, perchStart: backEnd + 2 };
}

/** A short, interruptible performance using the authored Rive motions. */
export function heroPerformance(seconds: number, m: Measures): HeroFrame | null {
  const { screen, cam } = m;
  if (!screen || !cam) return null;
  const timing = heroTimings(m);
  if (!timing) return null;
  const pxPerX = screen.width / glassWidth;
  const pxPerY = screen.height / glassHeight;
  const left = screen.left - (0.3 - 0.2571352) * pxPerX;
  const right = left + 0.6 * pxPerX;
  const top = screen.top - (0.4568334 - 0.4042329) * pxPerY;
  const table = screen.top + (0.4042329 + 0.001) * pxPerY;
  const camX = cam.left + cam.width / 2;
  const camFloor = cam.top + cam.height - 1;
  const outsideLeft = left - m.bodyPx * 0.24;
  const outsideRight = right + m.bodyPx * 0.24;
  const pose = (
    stage: Stage,
    t: number,
    x: number,
    y: number,
    facing = 0,
    clip: Rect | null = null,
  ): Placement => ({ stage, t: Math.min(0.999, Math.max(0, t)), x, y, facing, clip, ledge: 0 });
  if (seconds < 0.9)
    return {
      placement: pose('notice', seconds / 0.9, camX, camFloor, 0, cam),
      depth: null,
      action: null,
      insideProgress: 0.05 + (0.1 * seconds) / 0.9,
      finished: false,
    };
  if (seconds < 1.4)
    return {
      placement: pose('crouch', (seconds - 0.9) / 0.5, camX, camFloor, 0, cam),
      depth: null,
      action: null,
      insideProgress: 0.15 + (0.05 * (seconds - 0.9)) / 0.5,
      finished: false,
    };
  if (seconds < 2)
    return {
      placement: pose('brace', (seconds - 1.4) / 0.6, camX, camFloor, 0, cam),
      depth: null,
      action: null,
      insideProgress: 0.21,
      finished: false,
    };
  if (seconds < 3.5)
    return {
      placement: pose('leg-over', (seconds - 2) / 1.5, camX, camFloor),
      depth: 'front',
      action: null,
      insideProgress: null,
      finished: false,
    };
  if (seconds < 5) {
    const t = (seconds - 3.5) / 1.5;
    const fall = Math.max(0, Math.min(1, (t - 0.27) / 0.42));
    return {
      placement: pose('drop', t, camX, camFloor + (table - camFloor) * fall * fall),
      depth: 'front',
      action: null,
      insideProgress: null,
      finished: false,
    };
  }
  if (seconds < timing.frontEnd) {
    const t = (seconds - 5) / timing.frontDuration;
    return {
      placement: pose(
        'walk',
        t,
        mix(camX, outsideLeft, t),
        table,
        -Math.min(1, t * 8, (1 - t) * 8),
      ),
      depth: 'front',
      action: null,
      insideProgress: null,
      finished: false,
    };
  }
  if (seconds < timing.lookEnd)
    return {
      placement: pose(
        'walk',
        (seconds - timing.frontEnd) / 1.2,
        outsideLeft,
        table,
        Math.min(1, (seconds - timing.frontEnd) / 0.25, (timing.lookEnd - seconds) / 0.25),
      ),
      depth: 'front',
      action: 'look',
      insideProgress: null,
      finished: false,
    };
  if (seconds < timing.backEnd) {
    const t = (seconds - timing.lookEnd) / 6;
    return {
      placement: pose(
        'walk',
        t,
        mix(outsideLeft, outsideRight, t),
        table,
        Math.min(1, t * 8, (1 - t) * 8),
      ),
      depth: 'back',
      action: null,
      insideProgress: null,
      finished: false,
    };
  }
  if (seconds < timing.perchStart) {
    const t = (seconds - timing.backEnd) / 2;
    return {
      placement: pose('hop', t, mix(outsideRight, (left + right) / 2, t), mix(table, top, t)),
      depth: 'back',
      action: null,
      insideProgress: null,
      finished: false,
    };
  }
  const t = Math.min(1, seconds - timing.perchStart);
  return {
    // The seated rig's visible hip is a little above its soles anchor. Settle it
    // onto the front lip instead of leaving a sliver of light under the skirt.
    placement: pose('ledge', t, (left + right) / 2, top + m.bodyPx * 0.025 * smooth(t)),
    depth: 'front',
    action: null,
    insideProgress: null,
    finished: t >= 1,
  };
}
