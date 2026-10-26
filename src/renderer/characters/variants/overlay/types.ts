// Overlay shape sets for variants (hairstyles, head coverings, face and body features).
import type { Spring } from '../../../attachments/schema';
import type { OverlayAnchor } from '../rig';

/** Palette slots resolved per variant (overlay/palette.ts). */
export type PaintSlot =
  | 'hair'
  | 'hairShade'
  | 'hairDeep'
  | 'hairHighlight'
  | 'skin'
  | 'skinShade'
  | 'scalp'
  | 'line'
  | 'freckle'
  | 'vitiligo'
  | 'cover'
  | 'coverShade'
  | 'coverHighlight'
  | 'device'
  | 'deviceShade'
  | 'prosthetic'
  | 'prostheticShade'
  | 'white';

export interface Paint {
  slot: PaintSlot;
  alpha?: number;
}

export interface OverlayLayer {
  /** SVG path data. Head space unless `space` is 'anchor'. */
  d: string;
  fill?: Paint | undefined;
  stroke?: (Paint & { width: number }) | undefined;
  /** Drawn on the canvas behind the character (back hair) instead of in front. */
  behind?: boolean | undefined;
  /** Rig part the layer moves with (default: the head). */
  follow?: OverlayAnchor | undefined;
  /**
   * 'head' (default): coordinates are head space in the setup pose; the layer follows its
   * anchor's motion relative to that pose. 'anchor': coordinates are the anchor's local space
   * (forearms: x along the bone).
   */
  space?: 'head' | 'anchor' | undefined;
  /** Swing group (springs defined on the shape set). */
  spring?: string | undefined;
  evenOdd?: boolean | undefined;
}

export interface ShapeSet {
  layers: OverlayLayer[];
  springs?: Record<string, Spring>;
}
