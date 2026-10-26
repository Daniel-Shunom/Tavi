import { describe, expect, it } from 'vitest';
import {
  anchorPoint,
  describeLayout,
  headPoint,
  resolveAttention,
  type AttentionInput,
} from '../shared/attention';
import { defaultScene, type Scene } from '../shared/states';
import { AttentionSmoother } from '../src/renderer/attentionInput';
import { FaceLayer } from '../src/renderer/face/faceLayer';
import { getCharacter } from '../src/renderer/characters/registry';

const body = 220 / 720;
const rect = (x: number, y: number, w: number, h: number) => ({ enabled: true, x, y, w, h });
const layouts: Scene[] = [
  defaultScene,
  { ...defaultScene, chat: rect(0.02, 0.1, 0.2, 0.5), webcam: rect(0.72, 0.5, 0.25, 0.27) },
  { ...defaultScene, chat: rect(0.4, 0.05, 0.2, 0.2), game: rect(0.1, 0.1, 0.5, 0.4) },
];

describe('scene-aware attention resolver', () => {
  it('points every target the way it really is, for a grid of positions and layouts', () => {
    for (const scene of layouts)
      for (const x of [0.1, 0.3, 0.5, 0.7, 0.9])
        for (const y of [0.5, 0.7, 0.9])
          for (const facing of [-1, 1] as const)
            for (const target of ['chat', 'streamer', 'game'] as const) {
              const input: AttentionInput = { scene, position: { x, y }, bodyHeight: body, facing };
              const vector = resolveAttention(target, input);
              if (!vector) continue;
              const head = headPoint({ x, y }, body);
              const realDx = vector.point.x - head.x;
              const label = `${target} from ${String(x)},${String(y)}`;
              if (Math.abs(realDx) >= 0.01) {
                expect(vector.side, label).toBe(realDx < 0 ? -1 : 1);
                expect(Math.sign(vector.gaze.x), label).toBe(Math.sign(realDx));
              } else expect(vector.side, label).toBe(facing);
              if (Math.abs(vector.dy) > 0.01)
                expect(Math.sign(vector.gaze.y)).toBe(Math.sign(vector.point.y - head.y));
              expect(vector.behind).toBe(Math.abs(realDx) >= 0.01 && vector.side !== facing);
            }
  });
  it('aims the chat gesture at the actual chat panel, left or right', () => {
    const right = resolveAttention('chat', {
      scene: defaultScene,
      position: { x: 0.3, y: 0.8 },
      bodyHeight: body,
    });
    expect(right?.side).toBe(1);
    const left = resolveAttention('chat', {
      scene: { ...defaultScene, chat: rect(0.02, 0.1, 0.2, 0.5) },
      position: { x: 0.6, y: 0.8 },
      bodyHeight: body,
    });
    expect(left?.side).toBe(-1);
    // Standing under the panel: looks up, keeps facing.
    const above = resolveAttention('chat', {
      scene: { ...defaultScene, chat: rect(0.4, 0.05, 0.2, 0.2) },
      position: { x: 0.5, y: 0.9 },
      bodyHeight: body,
      facing: -1,
    });
    expect(above?.side).toBe(-1);
    expect(above?.gaze.y).toBeLessThan(-0.5);
  });
  it('falls back to the right with a note when no chat panel is placed', () => {
    const vector = resolveAttention('chat', {
      scene: { ...defaultScene, chat: { ...defaultScene.chat, enabled: false } },
      position: { x: 0.9, y: 0.8 },
      bodyHeight: body,
    });
    expect(vector?.side).toBe(1);
    expect(vector?.fallback).toContain('No chat panel');
  });
  it('walks to the real chat side and summarizes the layout for the AI', () => {
    const left = { ...defaultScene, chat: rect(0.02, 0.1, 0.2, 0.5) };
    expect(anchorPoint('chat', left).x).toBeLessThan(0.2);
    expect(anchorPoint('chat', defaultScene).x).toBeGreaterThan(0.8);
    const summary = describeLayout({ scene: left, position: { x: 0.6, y: 0.8 }, bodyHeight: body });
    expect(summary).toContain('chat is above-left');
    expect(
      describeLayout({ scene: defaultScene, position: { x: 0.3, y: 0.8 }, bodyHeight: body }),
    ).toContain('chat is above-right');
  });
});

describe('hook input for gaze, faces and pointing', () => {
  const attend = (side: -1 | 1) => () => ({
    target: 'chat' as const,
    point: { x: 0, y: 0 },
    dx: side * 0.3,
    dy: -0.1,
    distance: 0.32,
    side,
    gaze: { x: side * 0.9, y: -0.3 },
    behind: false,
  });
  it('converts screen direction into body-local side when the body is mirrored', () => {
    const smoother = new AttentionSmoother();
    const facingRight = smoother.update({ target: 'chat', weight: 1 }, attend(1), 1, 0.016);
    expect(facingRight).toMatchObject({ side: 1, screenSide: 1 });
    expect(facingRight?.gaze.x).toBeGreaterThan(0);
    const mirrored = new AttentionSmoother().update(
      { target: 'chat', weight: 1 },
      attend(1),
      -1,
      0.016,
    );
    // Facing left and mirrored: a target on screen-right is behind, so body-local side is -1.
    expect(mirrored).toMatchObject({ side: -1, screenSide: 1 });
    expect(mirrored?.gaze.x).toBeLessThan(0);
  });
  it('points the arm toward the target side on the v2 rig', () => {
    const face = getCharacter('mascot').face;
    if (!face?.poses['point']) throw new Error('mascot has no point pose');
    const sample = (side: -1 | 1) => {
      const layer = new FaceLayer(face);
      let values = {} as Record<string, number | undefined>;
      for (let time = 0; time < 1.2; time += 0.05)
        values = layer.update({
          dt: 0.05,
          time,
          cues: [{ expression: 'point', intensity: 0.8, weight: 1, elapsed: time, side }],
        }).values;
      return values;
    };
    const right = sample(1),
      left = sample(-1);
    // The raised arm swaps sides and the gaze follows the point.
    expect((right['armR'] ?? 0) - (right['armL'] ?? 0)).toBeGreaterThan(0.3);
    expect((left['armL'] ?? 0) - (left['armR'] ?? 0)).toBeGreaterThan(0.3);
    expect(Math.sign(right['gazeX'] ?? 0)).toBe(1);
    expect(Math.sign(left['gazeX'] ?? 0)).toBe(-1);
  });
});
