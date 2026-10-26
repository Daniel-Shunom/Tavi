// Custom appearance colours for characters whose colours are baked into appearance animations.
// The chosen animation's colour keys are rebuilt around a new main colour in memory, keeping
// the artist's shadows and highlights; the runtime then plays that animation as usual.
import { parseHex } from './color';
import { retarget } from './color';
import { recolorAnimation } from './riv/rivPatch';

export interface RecolorTarget {
  /** Appearance animation whose keys are rewritten (e.g. "hair Pink"). */
  animation: string;
  /** The animation's main colour; other keys keep their offset from it. */
  base: string;
  /** Colours left untouched (e.g. shoes keyed by the outfit animation). */
  keep?: readonly string[];
}

/** Lyla's appearance animations (artboard "lyla animation"). */
export const lylaRecolor = {
  artboard: 'lyla animation',
  hair: { animation: 'hair Pink', base: '#d80b4c' },
  outfit: { animation: 'clothing green', base: '#276065', keep: ['#7992af'] },
  glasses: { animation: 'glasses blue', base: '#2fc1e2', keep: ['#002aaf'] },
} as const;

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
