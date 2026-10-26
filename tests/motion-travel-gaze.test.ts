import { describe, expect, it } from 'vitest';
import { MotionLayer } from '../src/renderer/motion/motion';

const settings = {
  personality: 'cozy' as const,
  attitude: 'gentle' as const,
  energy: 40,
  reducedMotion: false,
  quiet: false,
};
const stage = { aspect: 16 / 9, bodyHeight: 0.3, margin: 0.02 };

function travelGaze(fromX: number, toX: number, turnStyle: 'authored' | 'mirror-hidden') {
  const layer = new MotionLayer(7, settings, stage, { feet: true, turnStyle });
  layer.place(fromX, 0.9);
  layer.moveTo({ x: toX, y: 0.9, at: 0, gait: 'walk' });
  const frames = [];
  for (let i = 0; i <= 90; i++) frames.push(layer.update(i / 60));
  return frames.slice(8);
}

describe('gaze follows locomotion destination', () => {
  it('looks screen-right while travelling right with an authored three-quarter turn', () => {
    const frames = travelGaze(0.3, 0.8, 'authored');
    const gaze = frames.map((frame) => frame.pose.gazeX);
    expect(gaze.some((x) => x > 0.3)).toBe(true);
    expect(gaze.filter((x) => x > 0.2).length).toBeGreaterThan(gaze.length / 2);
  });

  it('looks screen-left while travelling left, including when the rig mirrors', () => {
    const frames = travelGaze(0.8, 0.3, 'mirror-hidden');
    const screenGaze = frames.map((frame) => frame.pose.gazeX);
    expect(screenGaze.some((x) => x < -0.3)).toBe(true);
    expect(screenGaze.filter((x) => x < -0.2).length).toBeGreaterThan(screenGaze.length / 2);
  });

  it('keeps explicit scene attention ahead of the travel target', () => {
    const layer = new MotionLayer(7, settings, stage, { feet: true, turnStyle: 'authored' });
    layer.place(0.3, 0.9);
    layer.moveTo({ x: 0.8, y: 0.9, at: 0, gait: 'walk' });
    layer.attend({ x: -0.6, y: 0 });
    const frames = [];
    for (let i = 0; i <= 90; i++) frames.push(layer.update(i / 60));
    const gaze = frames.slice(8).map((frame) => frame.pose.gazeX);
    expect(gaze.some((x) => x < -0.2)).toBe(true);
  });
});
