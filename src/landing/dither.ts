// The hero's dithered light: the TV's glow spilling onto the wall behind it, drawn as an ordered
// (Bayer 8x8) dither, as on the screens of its era. It is densest behind the set and breaks into
// sparser dots as it falls off, which is what gives the room its depth. Static: painted once per
// size onto a 2D canvas at one cell per two CSS pixels (no WebGL, no download).

/** Bayer 8x8 thresholds, 0..1. */
const BAYER = (() => {
  const m = [0, 2, 3, 1];
  const out = new Float32Array(64);
  for (let y = 0; y < 8; y++)
    for (let x = 0; x < 8; x++) {
      let v = 0;
      for (let bit = 0; bit < 3; bit++) {
        const i = ((y >> bit) & 1) * 2 + ((x >> bit) & 1);
        v = v * 4 + (m[i] ?? 0);
      }
      out[y * 8 + x] = (v + 0.5) / 64;
    }
  return out;
})();

export type DitherLayer = 'off' | 'on' | 'seam';

export interface DitherOptions {
  /** Field size in cells. */
  width: number;
  height: number;
  /** The glow's centre and radii, as fractions of the field. */
  center: { x: number; y: number };
  radius: { x: number; y: number };
  /** Where the desk meets the wall, as a fraction of the field's height. */
  seam: number;
}

/** Light intensity at a cell, 0..1, for each layer. */
export function intensity(layer: DitherLayer, u: number, v: number, o: DitherOptions) {
  if (layer === 'seam') {
    // A band of light along the foot of the desk, fading out to the sides.
    const across = Math.max(0, 1 - Math.abs(u - o.center.x) / (o.radius.x * 1.05));
    const band = Math.exp(-(((v - o.seam) / 0.03) ** 2));
    return 0.8 * band * across ** 1.2;
  }
  const d = Math.hypot((u - o.center.x) / o.radius.x, (v - o.center.y) / o.radius.y);
  // A wide, low glow: dots stay well spaced near the set and carry a long way across the wall.
  const glow = Math.max(0, 1 - d) ** 1.35;
  return (layer === 'on' ? 0.66 : 0.4) * glow;
}

/** The colour of a lit cell: deeper towards the light, paler at the fringes. */
function tone(layer: DitherLayer, level: number): [number, number, number, number] {
  if (layer === 'off') return [150, 144, 160, 70];
  if (layer === 'seam') return [176, 146, 196, 64];
  return level > 0.5 ? [124, 88, 196, 96] : [160, 132, 214, 74];
}

/** RGBA pixels (one per cell) for a layer. */
export function ditherField(layer: DitherLayer, o: DitherOptions) {
  const pixels = new Uint8ClampedArray(o.width * o.height * 4);
  for (let y = 0; y < o.height; y++) {
    const v = y / o.height;
    for (let x = 0; x < o.width; x++) {
      const level = intensity(layer, x / o.width, v, o);
      if (level <= (BAYER[(y & 7) * 8 + (x & 7)] ?? 1)) continue;
      const [r, g, b, a] = tone(layer, level);
      const i = (y * o.width + x) * 4;
      pixels[i] = r;
      pixels[i + 1] = g;
      pixels[i + 2] = b;
      pixels[i + 3] = a;
    }
  }
  return pixels;
}

/** Paint a layer into a canvas sized to its box (one cell per `cell` CSS pixels). */
export function paintDither(
  canvas: HTMLCanvasElement,
  layer: DitherLayer,
  place: Omit<DitherOptions, 'width' | 'height'>,
  cell = 2,
) {
  if (!canvas.clientWidth || !canvas.clientHeight) return;
  const width = Math.max(1, Math.round(canvas.clientWidth / cell));
  const height = Math.max(1, Math.round(canvas.clientHeight / cell));
  if (canvas.width !== width) canvas.width = width;
  if (canvas.height !== height) canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) return;
  const image = context.createImageData(width, height);
  image.data.set(ditherField(layer, { ...place, width, height }));
  context.putImageData(image, 0, 0);
}
