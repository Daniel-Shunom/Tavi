// Colour helpers for attachment tints and .riv recolouring. Pure; no DOM.

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export function parseHex(hex: string): Rgb {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!match?.[1]) throw new Error('Invalid colour: ' + hex);
  const value = parseInt(match[1], 16);
  return { r: (value >> 16) & 255, g: (value >> 8) & 255, b: value & 255 };
}

export function toHex({ r, g, b }: Rgb) {
  const part = (v: number) =>
    Math.round(Math.min(255, Math.max(0, v)))
      .toString(16)
      .padStart(2, '0');
  return '#' + part(r) + part(g) + part(b);
}

function mix(a: Rgb, b: Rgb, t: number): Rgb {
  return { r: a.r + (b.r - a.r) * t, g: a.g + (b.g - a.g) * t, b: a.b + (b.b - a.b) * t };
}

/** Warm deep ink used for shadows so shading matches the mascot (never pure black). */
const INK: Rgb = { r: 42, g: 22, b: 52 };
const WHITE: Rgb = { r: 255, g: 255, b: 255 };

/** shade > 0 lightens toward white, shade < 0 darkens toward the warm ink colour. */
export function shade(hex: string, amount: number) {
  if (amount === 0) return hex.toLowerCase();
  const base = parseHex(hex);
  return toHex(amount > 0 ? mix(base, WHITE, amount) : mix(base, INK, -amount));
}

export interface Hsl {
  h: number;
  s: number;
  l: number;
}

export function rgbToHsl({ r, g, b }: Rgb): Hsl {
  const rn = r / 255,
    gn = g / 255,
    bn = b / 255;
  const max = Math.max(rn, gn, bn),
    min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === rn) h = (gn - bn) / d + (gn < bn ? 6 : 0);
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  return { h: h * 60, s, l };
}

export function hslToRgb({ h, s, l }: Hsl): Rgb {
  const hue = (((h % 360) + 360) % 360) / 360;
  if (s === 0) return { r: l * 255, g: l * 255, b: l * 255 };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const channel = (t: number) => {
    const x = t < 0 ? t + 1 : t > 1 ? t - 1 : t;
    if (x < 1 / 6) return p + (q - p) * 6 * x;
    if (x < 1 / 2) return q;
    if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6;
    return p;
  };
  return { r: channel(hue + 1 / 3) * 255, g: channel(hue) * 255, b: channel(hue - 1 / 3) * 255 };
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/**
 * Re-targets an ARGB colour that belongs to a palette whose main colour is `base` so the palette
 * is rebuilt around `target`: hue becomes the target's, saturation scales, and lightness keeps
 * its offset from the base, so shadows and highlights survive.
 */
export function retarget(argb: number, base: string, target: string): number {
  const alpha = (argb >>> 24) & 255;
  const source = rgbToHsl({ r: (argb >>> 16) & 255, g: (argb >>> 8) & 255, b: argb & 255 });
  const from = rgbToHsl(parseHex(base)),
    to = rgbToHsl(parseHex(target));
  const hueShift = source.h - from.h;
  const saturation = from.s > 0.01 ? source.s * (to.s / from.s) : to.s;
  const rgb = hslToRgb({
    h: to.h + (to.s < 0.05 ? 0 : hueShift),
    s: clamp01(saturation),
    l: clamp01(source.l + (to.l - from.l)),
  });
  return (
    ((alpha << 24) |
      (Math.round(rgb.r) << 16) |
      (Math.round(rgb.g) << 8) |
      Math.round(rgb.b)) >>>
    0
  );
}
