import { describe, expect, it } from 'vitest';
import { characters } from '../src/renderer/characters/registry';
import { expressions } from '../shared/expressions';
import { sampleFacePose } from '../src/renderer/face/pose';
import { FaceLayer } from '../src/renderer/face/faceLayer';

describe('custom streamer gestures', () => {
  it('keeps a failed perch preparation grounded, then unloads the crouch', () => {
    expect(expressions['perch-hesitate'].selectable).toBe(false);
    for (const id of ['mascot', 'mascot-v2']) {
      const definition = characters.get(id)?.face?.poses['perch-hesitate'];
      if (!definition) throw new Error(`${id} must support the blocked-perch gesture`);
      for (let time = 0; time <= 1.7; time += 1 / 60) {
        const pose = sampleFacePose(definition, 0.6, time);
        expect(pose.footLY ?? 0).toBe(0);
        expect(pose.footRY ?? 0).toBe(0);
        expect(pose.bob ?? 0).toBeGreaterThanOrEqual(0);
      }
      expect(sampleFacePose(definition, 0.6, 0.5).bob).toBeGreaterThan(0.01);
      expect(sampleFacePose(definition, 0.6, 1.7).bob).toBe(0);
    }
  });

  it('turns the open-handed thank-you toward either side of the stream', () => {
    const face = characters.get('mascot-v2')?.face;
    if (!face) throw new Error('Mascot v2 face missing');
    const perform = (side: -1 | 1) => {
      const layer = new FaceLayer(face, { ownBlinks: false });
      let frame = layer.update({ dt: 0, time: 0, cues: [] });
      for (let index = 1; index <= 90; index++)
        frame = layer.update({
          dt: 1 / 60,
          time: index / 60,
          cues: [{ expression: 'thank-you', intensity: 0.6, weight: 1, elapsed: index / 60, side }],
        });
      return frame.values;
    };
    const right = perform(1);
    const left = perform(-1);
    expect(right.handR).toBe(1);
    expect(left.handL).toBe(1);
    expect(right.elbowR).toBeCloseTo(-(left.elbowL ?? 0));
    expect(right.gazeX).toBeGreaterThan(0);
    expect(left.gazeX).toBeLessThan(0);
  });
});
