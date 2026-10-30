import { describe, expect, it } from 'vitest';
import { TabletopPerformance, type TabletopPoint } from '../src/avatar-lab/tabletop';

const curve = { duration: 1, distance: 0.1, distances: [0, 0.05, 0.1] };
const route: TabletopPoint[] = [
  { x: -0.4, z: 0.3 },
  { x: 0.4, z: 0.3 },
  { x: 0.4, z: 0 },
  { x: 0.34, z: 0, pause: 'brace' },
  { x: 0.4, z: 0 },
  { x: 0.4, z: -0.3 },
  { x: -0.4, z: -0.3 },
  { x: -0.4, z: 0.3 },
];
describe('autonomous tabletop performance', () => {
  it.each([30, 60, 144])(
    'keeps travel outside the television and stops for contact at %s fps',
    (fps) => {
      const actor = new TabletopPerformance(route, curve);
      const phases = new Set<string>();
      let previous = actor.update(0);
      for (let i = 0; i < fps * 100; i++) {
        const frame = actor.update(1 / fps);
        phases.add(frame.phase);
        expect(Math.abs(frame.x) < 0.3 && Math.abs(frame.z) < 0.25).toBe(false);
        const distance = Math.hypot(frame.x - previous.x, frame.z - previous.z);
        expect(distance).toBeLessThan(0.11 / fps);
        if (frame.phase === previous.phase && frame.phase !== 'walk') expect(distance).toBe(0);
        if (frame.phase === 'brace') {
          expect(frame.x).toBeCloseTo(0.34, 6);
          expect(Math.sin(frame.yaw)).toBeCloseTo(-1, 6);
        }
        previous = frame;
      }
      expect(phases).toEqual(new Set(['turn', 'walk', 'look', 'brace']));
    },
  );
  it('freezes root, orientation, clip phase and action when paused', () => {
    const actor = new TabletopPerformance(route, curve);
    actor.update(6);
    const before = actor.update(0);
    expect(actor.update(0)).toEqual(before);
  });
});
