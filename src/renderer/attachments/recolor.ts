// Custom appearance colours for characters whose colours are baked into appearance animations.
// The chosen animation's colour keys are rebuilt around a new main colour in memory, keeping
// the artist's shadows and highlights; the runtime then plays that animation as usual.
import { parseHex, retarget } from './color';
import { recolorAnimation } from './riv/rivPatch';

export interface RecolorTarget {
  /** Appearance animation whose keys are rewritten (e.g. a hair colour animation). */
  animation: string;
  /** The animation's main colour; other keys keep their offset from it. */
  base: string;
  /** Colours left untouched (e.g. shoes keyed by the outfit animation). */
  keep?: readonly string[];
}

function rgbOf(argb: number) {
  return argb & 0xffffff;
}

export function recolor(
  bytes: Uint8Array,
  artboard: string,
  target: RecolorTarget,
  color: string,
): Uint8Array {
  const keep = new Set(
    (target.keep ?? []).map((hex) => {
      const { r, g, b } = parseHex(hex);
      return (r << 16) | (g << 8) | b;
    }),
  );
  return recolorAnimation(bytes, artboard, target.animation, (argb) =>
    keep.has(rgbOf(argb)) ? argb : retarget(argb, target.base, color),
  );
}

/** Makes every colour key of the target transparent, hiding that part (e.g. built-in glasses). */
export function hide(bytes: Uint8Array, artboard: string, target: RecolorTarget): Uint8Array {
  return recolorAnimation(bytes, artboard, target.animation, (argb) => argb & 0xffffff);
}
