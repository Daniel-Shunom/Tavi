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
/** How densely a mark set into the light is dotted: mild, but enough to read as a shape. */
const MARK_LEVEL: Record<DitherLayer, number> = { off: 0.3, on: 0.52, seam: 0 };

export function ditherField(
  layer: DitherLayer,
  o: DitherOptions,
  marks?: Uint8Array | null,
  /** How densely marks are dotted (defaults to the layer's mild level). */
  markLevel = MARK_LEVEL[layer],
) {
  const pixels = new Uint8ClampedArray(o.width * o.height * 4);
  for (let y = 0; y < o.height; y++) {
    const v = y / o.height;
    for (let x = 0; x < o.width; x++) {
      // Cells inside a mark (the footnote logos) are dotted at a gentle, even density, and the
      // margin around them is left clear.
      const covered = marks?.[y * o.width + x] ?? 0;
      if (covered === 2) continue;
      const mark = covered === 1 ? markLevel : 0;
      const level = Math.max(mark, intensity(layer, x / o.width, v, o));
      if (level <= (BAYER[(y & 7) * 8 + (x & 7)] ?? 1)) continue;
      const [r, g, b, a] = tone(layer, level);
      const i = (y * o.width + x) * 4;
      pixels[i] = r;
      pixels[i + 1] = g;
      pixels[i + 2] = b;
      // Logo dots need distinct ink; the surrounding atmospheric glow stays translucent.
      pixels[i + 3] = covered === 1 ? Math.max(a, 184) : a;
    }
  }
  return pixels;
}

/** Paint a layer into a canvas sized to its box (one cell per `cell` CSS pixels). */
/** Something set into the light: an image or a word, placed by its centre (fractions of the
 * field) and its height in CSS pixels. */
export type DitherMark =
  | { image: HTMLImageElement; x: number; y: number; height: number }
  | { text: string; font: string; x: number; y: number; height: number };

/** Which cells the marks cover, rasterised at the field's cell size (a cell per `cell` px). */
export function markCells(
  width: number,
  height: number,
  marks: readonly DitherMark[],
  cell: number,
) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) return null;
  for (const mark of marks) {
    const h = mark.height / cell;
    const cx = mark.x * width,
      cy = mark.y * height;
    if ('image' in mark) {
      if (!mark.image.naturalWidth) continue;
      const w = (h * mark.image.naturalWidth) / mark.image.naturalHeight;
      context.drawImage(mark.image, cx - w / 2, cy - h / 2, w, h);
    } else {
      context.font = mark.font.replace('{size}', `${String(h)}px`);
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillText(mark.text, cx, cy);
    }
  }
  // A mark is its dark ink only: a logo's white fill (the glitch's open bubble) stays open.
  const rgba = context.getImageData(0, 0, width, height).data;
  const cells = new Uint8Array(width * height);
  for (let i = 0; i < cells.length; i++) {
    const ink = 255 - ((rgba[i * 4] ?? 0) + (rgba[i * 4 + 1] ?? 0) + (rgba[i * 4 + 2] ?? 0)) / 3;
    cells[i] = (rgba[i * 4 + 3] ?? 0) > 110 && ink > 110 ? 1 : 0;
  }
  // A clear margin two cells wide around the ink (2), so the marks read against a dense glow.
  const margin = cells.slice();
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      if (cells[y * width + x] !== 1) continue;
      for (let dy = -2; dy <= 2; dy++)
        for (let dx = -2; dx <= 2; dx++) {
          const j = (y + dy) * width + (x + dx);
          if (x + dx >= 0 && x + dx < width && y + dy >= 0 && y + dy < height && cells[j] === 0)
            margin[j] = 2;
        }
    }
  return margin;
}

export function paintDither(
  canvas: HTMLCanvasElement,
  layer: DitherLayer,
  place: Omit<DitherOptions, 'width' | 'height'>,
  cell = 2,
  marks: readonly DitherMark[] = [],
  markLevel?: number,
) {
  if (!canvas.clientWidth || !canvas.clientHeight) return;
  const width = Math.max(1, Math.round(canvas.clientWidth / cell));
  const height = Math.max(1, Math.round(canvas.clientHeight / cell));
  if (canvas.width !== width) canvas.width = width;
  if (canvas.height !== height) canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) return;
  const image = context.createImageData(width, height);
  const covered = marks.length ? markCells(width, height, marks, cell) : null;
  image.data.set(ditherField(layer, { ...place, width, height }, covered, markLevel));
  context.putImageData(image, 0, 0);
}

/** The Twitch glitch (official asset, Twitch brand pack) for the Twitch x Codex lockup. */
export const TWITCH_GLITCH = '/media/brand/twitch-glitch.svg';

/**
 * The Twitch x Codex lockup as marks: the glitch, a times sign, then the word, centred on
 * (`x`, `y`) as fractions of a field `fieldWidth` CSS pixels wide, `height` CSS pixels tall.
 */
export function lockup(
  glitch: HTMLImageElement,
  x: number,
  y: number,
  height: number,
  fieldWidth: number,
): DitherMark[] {
  const step = (height * 1.15) / Math.max(fieldWidth, 1);
  return [
    { image: glitch, x: x - step * 1.5, y, height },
    {
      text: '\u00d7',
      font: '500 {size} DM Sans, sans-serif',
      x: x - step * 0.5,
      y,
      height: height * 0.62,
    },
    {
      text: 'Codex',
      font: '600 {size} DM Sans, sans-serif',
      x: x + step * 1.0,
      y,
      height: height * 0.78,
    },
  ];
}
