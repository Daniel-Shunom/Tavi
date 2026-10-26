// Combines a variant's hairstyle, features and head covering into one ordered shape set and
// resolves its palette. Pure (no DOM): the drawer (overlay/layer.ts) renders the result.
import type { Variant } from '../../../../../shared/variants';
import type { Spring } from '../../../attachments/schema';
import { adjust, fromOklch, oklch } from '../colorScience';
import { hairPalette, skinPalette } from '../palettes';
import { DEFAULT_HAIR, effectiveHairColor } from '../apply';
import { coveringShapes, featureShapes } from './features';
import { hairstyleShapes } from './hairstyles';
import type { OverlayLayer, PaintSlot, ShapeSet } from './types';

export function overlayPalette(variant: Variant): Record<PaintSlot, string> {
  const skin = skinPalette(variant.skin.tone, variant.skin.undertone);
  const hair = hairPalette(effectiveHairColor(variant) ?? DEFAULT_HAIR);
  const cover = variant.covering.color;
  const device = variant.features.hearingAidColor;
  const prosthetic = variant.features.prostheticColor;
  const base = oklch(skin.base);
  return {
    hair: hair.base,
    hairShade: hair.shade,
    hairDeep: hair.deep,
    hairHighlight: hair.highlight,
    skin: skin.base,
    skinShade: skin.shade,
    // Scalp parts read as skin seen between sections.
    scalp: skin.shade,
    line: skin.nose,
    freckle: adjust(skin.shade, { dl: -0.08, kc: 1.1 }),
    // Depigmented skin: much lighter, a little pinker; subtle on light tones (as in life).
    vitiligo: fromOklch({
      l: Math.min(0.97, base.l + Math.max(0.05, 0.3 - 0.5 * (base.l - 0.3))),
      c: 0.045,
      h: 38,
    }),
    cover,
    coverShade: adjust(cover, { dl: -0.09, kc: 1.05 }),
    coverHighlight: adjust(cover, { dl: 0.1, kc: 0.9 }),
    device,
    deviceShade: adjust(device, { dl: -0.16 }),
    prosthetic,
    prostheticShade: adjust(prosthetic, { dl: -0.12 }),
    white: '#ffffff',
  };
}

/** Ordered layers: back (covering, hair) then front (features, hair, covering). */
export function variantShapes(variant: Variant): ShapeSet {
  const sets: [string, ShapeSet][] = [];
  const covered = variant.covering.kind !== 'none';
  sets.push(['features', featureShapes(variant)]);
  if (!covered) sets.push(['hair', hairstyleShapes(variant.hair.style)]);
  else sets.push(['covering', coveringShapes(variant.covering.kind)]);
  const springs: Record<string, Spring> = {};
  const back: OverlayLayer[] = [],
    front: OverlayLayer[] = [];
  for (const [prefix, set] of sets) {
    for (const [name, spring] of Object.entries(set.springs ?? {}))
      springs[`${prefix}.${name}`] = spring;
    for (const layer of set.layers) {
      const named = layer.spring ? { ...layer, spring: `${prefix}.${layer.spring}` } : layer;
      (layer.behind ? back : front).push(named);
    }
  }
  return { layers: [...back, ...front], springs };
}
