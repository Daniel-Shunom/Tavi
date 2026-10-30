import { describe, expect, it } from 'vitest';
import { ditherField, type DitherLayer } from '../src/landing/dither';

const place = {
  width: 200,
  height: 120,
  center: { x: 0.5, y: 0.4 },
  radius: { x: 0.3, y: 0.35 },
  seam: 0.65,
};
const lit = (layer: DitherLayer, x0: number, x1: number, y0: number, y1: number) => {
  const pixels = ditherField(layer, place);
  let on = 0,
    all = 0;
  for (let y = Math.round(y0 * place.height); y < Math.round(y1 * place.height); y++)
    for (let x = Math.round(x0 * place.width); x < Math.round(x1 * place.width); x++) {
      all++;
      if ((pixels[(y * place.width + x) * 4 + 3] ?? 0) > 0) on++;
    }
  return on / all;
};

describe('hero dithered light', () => {
  it('is densest by the TV and thins out to nothing beyond its reach', () => {
    const near = lit('on', 0.45, 0.55, 0.35, 0.45);
    const mid = lit('on', 0.68, 0.72, 0.35, 0.45);
    expect(near).toBeGreaterThan(mid);
    expect(mid).toBeGreaterThan(0);
    expect(lit('on', 0, 0.12, 0, 1)).toBe(0);
  });

  it('is fainter while the set shows static than once the signal locks', () => {
    expect(lit('off', 0.3, 0.7, 0.2, 0.6)).toBeLessThan(lit('on', 0.3, 0.7, 0.2, 0.6));
  });

  it('lights only a band along the foot of the desk for the floor seam', () => {
    expect(lit('seam', 0.4, 0.6, 0.62, 0.68)).toBeGreaterThan(0.2);
    expect(lit('seam', 0.4, 0.6, 0.2, 0.4)).toBe(0);
  });
});
