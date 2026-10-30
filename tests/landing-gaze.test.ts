import { describe, expect, it } from 'vitest';
import { HeroGaze, type GazeInput } from '../src/landing/heroGaze';
import { tabletopNodes, tabletopTracks, type TabletopFrame } from '../src/landing/tabletop';

const head = { x: 600, y: 400 };
const base: GazeInput = {
  dt: 1 / 60,
  pointer: null,
  head,
  bodyPx: 220,
  facing: 0,
  walking: 0,
  idleFor: Infinity,
};
function run(gaze: HeroGaze, seconds: number, input: Partial<GazeInput>) {
  let frame = gaze.update({ ...base, ...input });
  for (let t = 0; t < seconds; t += 1 / 60) {
    const idle = input.idleFor === undefined ? undefined : input.idleFor + t;
    frame = gaze.update({ ...base, ...input, ...(idle === undefined ? {} : { idleFor: idle }) });
  }
  return frame;
}

describe('landing hero gaze', () => {
  it('looks toward a moving pointer with the eyes leading the head', () => {
    const gaze = new HeroGaze();
    run(gaze, 1, {});
    const right = { x: head.x + 600, y: head.y };
    const early = run(gaze, 0.08, { pointer: right, idleFor: 0 });
    expect(early.eyes.x).toBeGreaterThan(6);
    expect(early.turnHead).toBeLessThan(0.2);
    const settled = run(gaze, 1.2, { pointer: right, idleFor: 0 });
    expect(settled.turnHead).toBeGreaterThan(0.25);
    // Full reach is 0.5; a playful head may overshoot it a touch while settling.
    expect(settled.turnHead).toBeLessThanOrEqual(0.58);
    expect(settled.interest).toBeGreaterThan(0.95);
    const left = run(gaze, 1.5, { pointer: { x: head.x - 600, y: head.y + 200 }, idleFor: 0 });
    expect(left.eyes.x).toBeLessThan(-4);
    expect(left.eyes.y).toBeGreaterThan(2);
    expect(left.turnHead).toBeLessThan(-0.25);
  });

  it('loses interest when the pointer rests, sooner when it is far away', () => {
    const near = new HeroGaze(),
      far = new HeroGaze();
    const close = { x: head.x + 120, y: head.y };
    const distant = { x: head.x + 900, y: head.y };
    run(near, 0.5, { pointer: close, idleFor: 0 });
    run(far, 0.5, { pointer: distant, idleFor: 0 });
    expect(run(near, 3.5, { pointer: close, idleFor: 0.5 }).interest).toBeGreaterThan(0.9);
    expect(run(far, 3.5, { pointer: distant, idleFor: 0.5 }).interest).toBeLessThan(0.5);
    expect(run(near, 4, { pointer: close, idleFor: 4 }).interest).toBeLessThan(0.1);
  });

  it.each([
    ['30 fps', () => 1 / 30],
    ['144 fps', () => 1 / 144],
    ['hitching frames', (i: number) => (i % 7 === 0 ? 0.05 : i % 3 ? 1 / 60 : 1 / 24)],
  ])('settles on a steady pointer without twitching at %s', (_, step) => {
    const gaze = new HeroGaze();
    const pointer = { x: head.x + 400, y: head.y - 150 };
    let previous = gaze.update({ ...base, pointer, idleFor: 0 });
    let lastDelta = { x: 0, y: 0 };
    const reversed = { x: false, y: false };
    let reversals = 0,
      twitches = 0;
    for (let i = 1, t = 0; t < 4; i++) {
      const dt = step(i);
      t += dt;
      const frame = gaze.update({ ...base, dt, pointer, idleFor: 0 });
      const delta = { x: frame.eyes.x - previous.eyes.x, y: frame.eyes.y - previous.eyes.y };
      // One visible change of direction is the eyes holding the target as the head settles; a
      // twitch is the eyes flipping direction again on the very next frame.
      for (const axis of ['x', 'y'] as const) {
        const flip = delta[axis] * lastDelta[axis] < 0 && Math.abs(delta[axis]) > 0.15;
        if (flip) reversals++;
        if (flip && reversed[axis]) twitches++;
        reversed[axis] = flip;
      }
      expect(Math.abs(frame.turnHead - previous.turnHead) / dt).toBeLessThan(6);
      lastDelta = delta;
      previous = frame;
    }
    expect(twitches).toBe(0);
    expect(reversals).toBeLessThanOrEqual(2);
  });

  it('keeps every frame continuous and in range', () => {
    const gaze = new HeroGaze();
    let previous = gaze.update(base);
    for (let i = 0; i < 60 * 40; i++) {
      const t = i / 60;
      // Pointer appears, sweeps, rests, leaves; Tavi walks for part of it.
      const pointer =
        t > 5 && t < 25 ? { x: head.x + Math.sin(t * 1.7) * 700, y: head.y + 100 } : null;
      const walking = t > 18 && t < 30 ? 1 : 0;
      const frame = gaze.update({
        ...base,
        pointer,
        idleFor: t < 14 ? 0 : t - 14,
        walking,
        facing: walking ? -1 : 0,
      });
      expect(Math.abs(frame.eyes.x)).toBeLessThanOrEqual(12);
      expect(Math.abs(frame.eyes.y)).toBeLessThanOrEqual(8);
      expect(Math.abs(frame.turnHead)).toBeLessThanOrEqual(1);
      // The scene snaps facing for this test; the look itself must never jerk the head.
      if (walking === (t - 1 / 60 > 18 && t - 1 / 60 < 30 ? 1 : 0))
        expect(Math.abs(frame.turnHead - previous.turnHead) * 60).toBeLessThan(6);
      previous = frame;
    }
  });

  it('holds the travel turn while walking and only owns the pupils when given a gaze', () => {
    const gaze = new HeroGaze();
    const frame = run(gaze, 2, { walking: 1, facing: 1 });
    expect(frame.turnHead).toBeCloseTo(0.85, 2);
    const table = {
      placement: { stage: 'walk', t: 0.5, x: 0, y: 0, facing: 1, clip: null, ledge: 0 },
      depth: 'front',
      action: 'walk',
      phase: 0,
      weight: 1,
      seated: 0,
      reaction: 0,
      surface: 'desk',
      gaits: [{ foundation: 'walk', phase: 0, mix: 1 }],
      jump: null,
      ground: { y: 0, lift: 0 },
      travel: 0,
    } satisfies TabletopFrame;
    const turn = (gazeFrame: typeof frame | null) =>
      tabletopTracks(table, gazeFrame).find((t) => t.track === 'ctl.turn-head')?.time;
    expect(turn(null)).toBeCloseTo((0.85 + 1) / 2, 5);
    expect(tabletopNodes(table, null)['eyes']).toBeUndefined();
    expect(tabletopNodes(table, frame)['eyes']).toEqual(frame.eyes);
  });
});
