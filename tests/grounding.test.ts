import { expect, it } from 'vitest';
import { getCharacter } from '../src/renderer/characters/registry';
import { drawFrame, solesY } from '../src/renderer/placement';

it('declares where the mascot soles are drawn', () => {
  expect(getCharacter('mascot').soleOffset).toBeCloseTo(55 / 600, 6);
});

it('puts the soles exactly on placement.y for any size and pixel ratio', () => {
  const artboard = { minX: 0, minY: 0, maxX: 600, maxY: 600 };
  for (const ratio of [1, 1.5, 2])
    for (const placement of [
      { x: 300, y: 500, width: 176, height: 220, rotation: 0 },
      { x: 640, y: 690, width: 400, height: 300, rotation: 0 },
      { x: 100, y: 200, width: 80, height: 300, rotation: 0 },
    ]) {
      const frame = drawFrame(placement, ratio, artboard, 55 / 600);
      expect(solesY(frame, artboard, 55 / 600)).toBeCloseTo(placement.y * ratio, 6);
      expect(frame.maxX - frame.minX).toBeCloseTo(placement.width * ratio, 6);
    }
  const flat = drawFrame({ x: 10, y: 50, width: 20, height: 40, rotation: 0 }, 1, artboard, 0);
  expect(flat.maxY).toBe(50);
});
