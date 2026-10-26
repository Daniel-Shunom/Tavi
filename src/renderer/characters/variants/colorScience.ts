// Perceptual colour helpers for variant palettes: OKLCH (lightness, chroma, hue) and WCAG
// contrast. Pure. Used to build undertones and hair ramps and by the ramp tests.
import { parseHex, toHex } from '../../attachments/color';

export interface Oklch {
  /** 0..1 perceptual lightness. */
  l: number;
  /** Chroma (0 = grey; skin is roughly 0.03..0.12). */
  c: number;
  /** Hue in degrees (skin sits around 30..75: red-orange to yellow-orange). */
  h: number;
}

const toLinear = (v: number) => {
  const c = v / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};
const fromLinear = (v: number) => {
  const c = v <= 0.0031308 ? 12.92 * v : 1.055 * Math.max(0, v) ** (1 / 2.4) - 0.055;
  return c * 255;
};

export function oklch(hex: string): Oklch {
  const { r, g, b } = parseHex(hex);
  const [lr, lg, lb] = [toLinear(r), toLinear(g), toLinear(b)];
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  const h = (Math.atan2(B, A) * 180) / Math.PI;
  return { l: L, c: Math.hypot(A, B), h: h < 0 ? h + 360 : h };
}

export function fromOklch({ l: L, c, h }: Oklch): string {
  const A = c * Math.cos((h * Math.PI) / 180),
    B = c * Math.sin((h * Math.PI) / 180);
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
  return toHex({
    r: fromLinear(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    g: fromLinear(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    b: fromLinear(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  });
}

/** WCAG 2.x relative luminance and contrast ratio. */
export function luminance(hex: string) {
  const { r, g, b } = parseHex(hex);
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}
export function contrast(a: string, b: string) {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p) as [number, number];
  return (x + 0.05) / (y + 0.05);
}

/** Moves a colour in OKLCH: lightness/chroma deltas and a hue rotation (degrees). */
export function adjust(hex: string, { dl = 0, dc = 0, dh = 0, kc = 1 } = {}) {
  const c = oklch(hex);
  return fromOklch({
    l: Math.min(0.99, Math.max(0.02, c.l + dl)),
    c: Math.max(0, c.c * kc + dc),
    h: c.h + dh,
  });
}
