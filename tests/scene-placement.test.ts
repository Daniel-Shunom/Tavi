import { describe, expect, it } from 'vitest';
import { clearSceneLanding } from '../shared/scenePlacement';
import { defaultScene, type Scene } from '../shared/states';

const footprint = { halfWidth: 0.05, height: 0.22 };

describe('clearSceneLanding', () => {
  it('keeps destinations that do not overlap an enabled panel unchanged', () => {
    const target = { x: 0.55, y: 0.92 };
    expect(clearSceneLanding(target, defaultScene, footprint)).toBe(target);
  });

  it('moves an overlapping landing to the nearest point with a clear character footprint', () => {
    const scene: Scene = {
      ...defaultScene,
      webcam: { enabled: false, x: 0.1, y: 0.4, w: 0.3, h: 0.3 },
      chat: { enabled: true, x: 0.7, y: 0.3, w: 0.2, h: 0.4 },
      game: { enabled: false, x: 0.2, y: 0.1, w: 0.5, h: 0.5 },
    };
    const target = { x: 0.8, y: 0.6 };
    const result = clearSceneLanding(target, scene, footprint);
    expect(result).not.toEqual(target);
    expect(result.x).toBeGreaterThanOrEqual(0.08);
    expect(result.x).toBeLessThanOrEqual(0.92);
    expect(result.y).toBeGreaterThanOrEqual(0.35);
    expect(result.y).toBeLessThanOrEqual(0.95);
    expect(result.x + footprint.halfWidth).toBeLessThanOrEqual(scene.chat.x);
  });

  it('ignores disabled panels', () => {
    const scene: Scene = {
      ...defaultScene,
      webcam: { ...defaultScene.webcam, enabled: false },
      chat: { ...defaultScene.chat, enabled: false },
      game: { ...defaultScene.game, enabled: false },
    };
    const target = { x: 0.5, y: 0.6 };
    expect(clearSceneLanding(target, scene, footprint)).toBe(target);
  });
});
