import { describe, expect, it } from 'vitest';
import { expressionIds } from '../shared/expressions';
import { foundationMotion } from '../src/renderer/characters/tavi-foundation/motion';
import { bindRefined } from '../src/renderer/characters/tavi-refined/motion';
import { neutralPose, type MotionFrame } from '../src/renderer/motion/types';
import { BodyRig } from '../src/renderer/rig/body';
import {
  inversePoint,
  transformPoint,
  solveContact,
  angleDelta,
} from '../src/renderer/rig/contact';
import { sleepControls, sleepEnvelope } from '../src/renderer/rig/sleep';
import { sleepSettle } from '../src/renderer/rig/demo';
import { restKey } from '../src/renderer/motion/states/types';
import type { PlayerResult } from '../src/renderer/motion/states/player';
const frame = (): MotionFrame => ({
  time: 0,
  pose: { ...neutralPose(), armL: 0.7, elbowL: 0.8, headTilt: 0.05, smile: 0.2 },
  clips: [],
  placement: {
    x: 0.5,
    y: 1,
    facing: 1,
    lean: 0,
    scaleX: 1,
    scaleY: 1,
    opacity: 1,
    clipBelow: null,
  },
  shadow: { x: 0.5, y: 1, scale: 1, opacity: 1 },
  status: {
    airborne: 0,
    expressions: [],
    locomotion: 'idle',
    choreography: null,
    fidget: null,
    hidden: false,
  },
});
function nap(weight: number) {
  const result: PlayerResult = {
    key: { ...restKey, sleep: weight, pose: { squash: 0.65, footLY: 0.03, footRY: 0.05 } },
    surfaceY: null,
    height: 0,
    floorShadow: null,
    effects: [],
    ledge: null,
    status: 'nap',
  };
  return { id: 'nap', result };
}
describe('sleep support and expression compatibility', () => {
  it.each(expressionIds)('preserves the existing awake %s binding', (id) => {
    const f = frame();
    f.status.expressions = [id];
    f.clips = [{ role: id, time: 0.4, mix: 0.7 }];
    expect(foundationMotion.bind(f)).toEqual(bindRefined(f));
  });
  it('owns breathing only during sleep and releases on wake without modifying inputs', () => {
    const source = frame(),
      before = structuredClone(source);
    const sleeping = foundationMotion.bind(source, nap(1));
    expect(sleeping.bodyControls).toMatchObject({ headSupport: 1, sleepSupport: 1 });
    expect(foundationMotion.bind(source, nap(0)).bodyControls).toBeUndefined();
    expect(foundationMotion.bind(source).bodyControls).toBeUndefined();
    expect(source).toEqual(before);
  });
  it('uses the shared service clock so reconnecting does not restart breathing', () => {
    const a = frame(),
      b = frame();
    a.time = 0;
    b.time = 123;
    a.serviceTime = b.serviceTime = 200.8;
    expect(foundationMotion.bind(a, nap(1)).bodyControls).toEqual(
      foundationMotion.bind(b, nap(1)).bodyControls,
    );
  });
  it('retains source nap support during wake and respects reduced motion', () => {
    const source = frame(),
      waking = nap(0.7);
    waking.id = 'stand';
    waking.result.napSupport = 0.7;
    expect(foundationMotion.bind(source, waking).bodyControls?.sleepSupport).toBeGreaterThan(0);
    source.reducedMotion = true;
    expect(foundationMotion.bind(source, nap(1)).bodyControls).toMatchObject({
      chestTilt: 0,
      neckTilt: 0,
      sleepSupport: 1,
    });
  });
  it('replaces whole-body breathing and foot twitches with a fixed held silhouette', () => {
    const a = frame(),
      b = frame();
    a.pose.squash = 0.65;
    b.pose.squash = 0.9;
    a.pose.footRX = -0.06;
    b.pose.footRX = 0.15;
    const x = foundationMotion.bind(a, nap(1)),
      y = foundationMotion.bind(b, nap(1));
    expect(x.nodes).toEqual(y.nodes);
    expect(x.tracks).toEqual(y.tracks);
  });
  it('keeps the head at its support origin while chest and neck breathe', () => {
    const head = { x: 0, y: -100, rotation: 0 },
      neck = { x: 0, y: -96, rotation: 0 },
      collar = { x: 0, y: -85, rotation: 0 };
    const rig = new BodyRig({
      head,
      neck,
      collar,
      pelvis: { x: 0, y: 0, rotation: 0 },
      chest: [head, neck, collar],
    });
    for (let t = 0; t < 8; t += 1 / 120) {
      rig.prepare();
      rig.apply(sleepControls(t, 1));
      expect(head.x).toBeCloseTo(0, 10);
      expect(head.y).toBe(-100);
      expect(head.rotation).toBeCloseTo(0, 10);
    }
  });
  it('matches FK elbows and reaches with fixed segment lengths in mirrored parents', () => {
    const parent = [-1.1, 0.1, 0.05, 0.9, 250, 300] as const;
    const target = [260, 310] as const;
    expect(transformPoint(parent, inversePoint(parent, target))).toEqual(target);
    for (const x of [-60, -20, 20, 60])
      for (const y of [-60, 30, 60]) {
        const s = solveContact([0, 0], [x, y], [-25, 40], 51, 47);
        expect(Math.hypot(...s.joint)).toBeCloseTo(51, 8);
        expect(Math.hypot(s.end[0] - s.joint[0], s.end[1] - s.joint[1])).toBeCloseTo(47, 8);
        expect(s.error).toBe(0);
      }
    expect(Math.abs(angleDelta(Math.PI - 0.01, -Math.PI + 0.01))).toBeCloseTo(0.02, 8);
    expect(() => inversePoint([0, 0, 0, 0, 0, 0], target)).toThrow('Singular');
  });
  it('settles and releases with zero endpoint velocity and a seamless breathing loop', () => {
    expect(sleepSettle(0)).toBe(0);
    expect(sleepSettle(2)).toBe(1);
    expect(sleepSettle(6)).toBe(1);
    expect(sleepSettle(8)).toBe(0);
    const h = 1e-4;
    expect(sleepSettle(h) / h).toBeLessThan(1e-6);
    expect(sleepSettle(8 - h) / h).toBeLessThan(1e-6);
    expect(sleepEnvelope(0)).toBe(sleepEnvelope(4));
    expect(sleepControls(0, 0)).toMatchObject({ headSupport: 0, sleepSupport: 0, chestTilt: 0 });
  });
});
