import { describe, expect, it } from 'vitest';
import { BodyRig, boundedBody, bodyLimits, type BodyParts } from '../src/renderer/rig/body';
import { foundationMotion } from '../src/renderer/characters/tavi-foundation/motion';
import { refinedMotion } from '../src/renderer/characters/tavi-refined/motion';
import { sleepEnvelope, demoFrame, demoPlacement } from '../src/renderer/rig/demo';
import { neutralPose, type MotionFrame } from '../src/renderer/motion/types';
function fixture() {
  const pelvis = { x: 0, y: 0, rotation: 0 };
  const head = { x: 0, y: -100, rotation: 0 },
    neck = { x: 0, y: -95, rotation: 0 },
    collar = { x: 0, y: -85, rotation: 0 };
  const arm = { x: -40, y: -70, rotation: 0.1 };
  const parts: BodyParts = { pelvis, head, neck, collar, chest: [head, neck, collar, arm] };
  return { parts, arm, rig: new BodyRig(parts) };
}
const frame = (): MotionFrame => ({
  time: 0,
  pose: neutralPose(),
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
describe('independent body components', () => {
  it('keeps the sleep study correctly bound, bounded and loop-compatible', () => {
    for (const time of [0, 0.4, 1.6, 2, 3.9, 4, 8]) {
      expect(sleepEnvelope(time)).toBeGreaterThanOrEqual(0);
      expect(sleepEnvelope(time)).toBeLessThanOrEqual(1);
      const sample = demoFrame('Sleep', time, 1, {}, true);
      expect(sample.nodes['runtime-mode']?.x).toBe(4);
      expect(sample.tracks.some((t) => t.track.startsWith('runtime.pose.'))).toBe(false);
      expect(Math.abs(sample.bodyControls?.chestTilt ?? 0)).toBeLessThanOrEqual(0.004);
    }
    expect(sleepEnvelope(0)).toBe(sleepEnvelope(4));
    expect(demoPlacement('Sleep', 400, 600, 600).rotation).not.toBe(0);
  });

  it('preserves the exact neutral pose and component order', () => {
    const { parts, rig } = fixture(),
      before = structuredClone(parts),
      order = [...parts.chest];
    rig.apply();
    expect(parts).toEqual(before);
    rig.prepare();
    expect(parts).toEqual(before);
    expect(parts.chest).toEqual(order);
  });
  it('rotates chest around the waist without moving the pelvis', () => {
    const { parts, rig } = fixture();
    rig.apply({ chestTilt: 0.1 });
    expect(parts.pelvis).toEqual({ x: 0, y: 0, rotation: 0 });
    expect(parts.head.x).toBeCloseTo(100 * Math.sin(0.1), 10);
    expect(parts.head.y).toBeCloseTo(-100 * Math.cos(0.1), 10);
  });
  it('keeps the neck pivot connected and can stabilize the head against chest and neck', () => {
    const { parts, rig } = fixture();
    rig.apply({ chestTilt: 0.1, neckTilt: 0.07, headStabilize: 1 });
    expect(parts.head.rotation).toBeCloseTo(0, 10);
    expect(Math.hypot(parts.head.x - parts.collar.x, parts.head.y - parts.collar.y)).toBeCloseTo(
      15,
      10,
    );
    expect(parts.collar.rotation).toBeCloseTo(0.1, 10);
  });
  it('does not accumulate offsets on repeated evaluation or overwrite next-frame animation', () => {
    const { parts, rig, arm } = fixture();
    rig.apply({ chestTilt: 0.1, pelvisTilt: 0.04 });
    const first = structuredClone(parts);
    rig.apply({ chestTilt: 0.1, pelvisTilt: 0.04 });
    expect(parts).toEqual(first);
    rig.prepare();
    arm.x = -52;
    arm.rotation = 0.7;
    rig.apply({ chestTilt: -0.1 });
    rig.prepare();
    expect(arm.x).toBe(-52);
    expect(arm.rotation).toBe(0.7);
    expect(parts.pelvis.rotation).toBe(0);
  });
  it('protects authored ranges and rejects non-finite input before any mutation', () => {
    expect(boundedBody({ chestTilt: 999, pelvisTilt: -999, headStabilize: 3 })).toMatchObject({
      chestTilt: bodyLimits.chestTilt,
      pelvisTilt: -bodyLimits.pelvisTilt,
      headStabilize: 1,
    });
    const { parts, rig } = fixture(),
      before = structuredClone(parts);
    expect(() => rig.apply({ neckTilt: NaN })).toThrow('Non-finite');
    expect(parts).toEqual(before);
  });
  it('passes explicit controls through the foundation binding and keeps the default binding neutral', () => {
    const source = frame();
    expect(foundationMotion.bind(source)).toEqual(refinedMotion.bind(source));
    source.bodyControls = { chestTilt: 0.04, headStabilize: 1 };
    expect(foundationMotion.bind(source).bodyControls).toEqual(source.bodyControls);
  });
});
