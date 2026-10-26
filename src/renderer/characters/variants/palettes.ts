// Variant palettes: the skin-tone ramp with undertones, hair colours and eye colours.
// Rules (docs/character/VARIANTS-RESEARCH.md section 7, enforced by tests/variants.test.ts):
// skin shades rotate hue toward red and keep chroma (never mixed toward grey or black),
// highlights stay warm, features keep one shape and one hue for every tone.
import {
  skinRamp,
  type EyeColor,
  type SkinTone,
  type Undertone,
} from '../../../../shared/variants';
import { adjust, fromOklch, oklch } from './colorScience';

export interface SkinPalette {
  base: string;
  shade: string;
  highlight: string;
  /** Cheek blush (drawn at partial opacity). */
  blush: string;
  /** Nose line. */
  nose: string;
  /** Mouth line: one berry hue for everyone; only its lightness follows the tone. */
  mouth: string;
}

export { skinRamp };

/** Undertone as a hue rotation (OKLCH degrees; lower = redder) and chroma factor. */
const undertoneShift: Readonly<Record<Undertone, { dh: number; kc: number }>> = {
  warm: { dh: 4, kc: 1.06 },
  neutral: { dh: 0, kc: 1 },
  cool: { dh: -7, kc: 0.97 },
  olive: { dh: 11, kc: 0.86 },
};

/** The mascot's own (fantasy pink) colours, for completeness of the palette API. */
export const originalSkin: SkinPalette = {
  base: '#ffb2b2',
  shade: '#ff8282',
  highlight: '#ffd6e0',
  blush: '#ffb5e2',
  nose: '#d25b5b',
  mouth: '#eb0066',
};

const MOUTH_HUE = 8;
/** One berry hue for every tone; chroma eases off when dark so the hue survives the gamut. */
function mouthLine(skinL: number) {
  const l = Math.max(0.09, Math.min(0.5, skinL - 0.32));
  return fromOklch({ l, c: Math.min(0.13, 0.02 + l * 0.42), h: MOUTH_HUE });
}

export function skinPalette(tone: SkinTone, undertone: Undertone): SkinPalette {
  if (tone === 'original') return originalSkin;
  const [b, s, h] = skinRamp[tone];
  const { dh, kc } = undertoneShift[undertone];
  const base = adjust(b, { dh, kc }),
    shade = adjust(s, { dh, kc }),
    highlight = adjust(h, { dh, kc });
  const lb = oklch(base);
  return {
    base,
    shade,
    highlight,
    // Rosier, never darker on deep tones (a darker blush reads as shadows under the eyes).
    blush: fromOklch({
      l: lb.l + (lb.l < 0.6 ? 0.13 - 0.1 * lb.l : -0.04),
      c: Math.max(0.09, lb.c + 0.05),
      h: lb.l < 0.6 ? 32 : 22,
    }),
    nose: adjust(shade, { dl: -0.12, kc: 1.05 }),
    mouth: mouthLine(lb.l),
  };
}

export interface ColorOption {
  id: string;
  label: string;
  hex: string;
}

/** Natural hair colours first, dyes after; never coupled to skin tone. */
export const hairColors: readonly (ColorOption & { group: 'natural' | 'dyed' })[] = [
  { id: 'black', label: 'Black', hex: '#2a211e', group: 'natural' },
  { id: 'blue-black', label: 'Blue-black', hex: '#232331', group: 'natural' },
  { id: 'dark-brown', label: 'Dark brown', hex: '#3f2a20', group: 'natural' },
  { id: 'brown', label: 'Brown', hex: '#6a4430', group: 'natural' },
  { id: 'light-brown', label: 'Light brown', hex: '#8f6444', group: 'natural' },
  { id: 'auburn', label: 'Auburn', hex: '#8a3a22', group: 'natural' },
  { id: 'red', label: 'Red', hex: '#b5502b', group: 'natural' },
  { id: 'strawberry', label: 'Strawberry blonde', hex: '#cf8a5c', group: 'natural' },
  { id: 'dark-blonde', label: 'Dark blonde', hex: '#a98450', group: 'natural' },
  { id: 'blonde', label: 'Blonde', hex: '#dcb978', group: 'natural' },
  { id: 'platinum', label: 'Platinum', hex: '#e8dcbf', group: 'natural' },
  { id: 'salt-pepper', label: 'Salt and pepper', hex: '#8d8a87', group: 'natural' },
  { id: 'silver', label: 'Silver', hex: '#c4c6cc', group: 'natural' },
  { id: 'white', label: 'White', hex: '#ebe9e4', group: 'natural' },
  { id: 'pink', label: 'Pink (original)', hex: '#d80b4c', group: 'dyed' },
  { id: 'rose', label: 'Rose', hex: '#e2618f', group: 'dyed' },
  { id: 'violet', label: 'Violet', hex: '#7d55c7', group: 'dyed' },
  { id: 'blue', label: 'Blue', hex: '#3b78d0', group: 'dyed' },
  { id: 'teal', label: 'Teal', hex: '#1c9c93', group: 'dyed' },
  { id: 'green', label: 'Green', hex: '#4f9f45', group: 'dyed' },
];

export interface HairPalette {
  base: string;
  shade: string;
  /** Deeper shade for texture marks (coils, braid chevrons, loc segments). */
  deep: string;
  highlight: string;
}

/** Builds a hair ramp: dark hair keeps a visible, hue-tinted highlight instead of flat black. */
export function hairPalette(hex: string): HairPalette {
  const c = oklch(hex);
  const dark = c.l < 0.4;
  return {
    base: hex.toLowerCase(),
    shade: adjust(hex, { dl: dark ? -0.06 : -0.1, kc: 1.08, dh: -6 }),
    deep: adjust(hex, { dl: dark ? -0.11 : -0.18, kc: 1.1, dh: -8 }),
    highlight: adjust(hex, { dl: dark ? 0.16 : 0.12, kc: dark ? 1.1 : 0.85, dh: 6 }),
  };
}

/** Brows follow the hair, darkened a step so light hair still frames the face. */
export function browColor(hair: string) {
  const c = oklch(hair);
  return fromOklch({ l: Math.min(c.l, 0.55) - 0.08, c: Math.min(0.12, c.c * 1.1), h: c.h });
}

export const eyePalettes: Readonly<
  Record<EyeColor, { label: string; dark: string; light: string }>
> = {
  'dark-brown': { label: 'Dark brown', dark: '#1a0d08', light: '#94603a' },
  brown: { label: 'Brown', dark: '#2c1409', light: '#b97c44' },
  hazel: { label: 'Hazel', dark: '#30230c', light: '#b59c48' },
  green: { label: 'Green', dark: '#0e2f1d', light: '#5cb06e' },
  blue: { label: 'Blue', dark: '#0c2846', light: '#5f9ddc' },
  grey: { label: 'Grey', dark: '#1f2b33', light: '#9fb2be' },
  teal: { label: 'Teal (original)', dark: '#003537', light: '#0b9484' },
};

export const ARGB = (hex: string, alpha = 255) =>
  ((alpha << 24) | parseInt(hex.slice(1), 16)) >>> 0;
