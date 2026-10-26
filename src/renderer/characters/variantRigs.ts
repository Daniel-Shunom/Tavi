// Browser-only registry of variant rigs per character (which fills are skin/hair/eyes, which
// parts builds and face shapes edit, which nodes overlays follow). Characters without one render
// as authored. Kept out of registry.ts, which the service imports and must stay plain data.
import type { VariantRig } from './variants/rig';
import { mascotV2VariantRig } from './variants/rigs/mascotV2';

export const variantRigs: Readonly<Record<string, VariantRig | undefined>> = {
  'mascot-v2': mascotV2VariantRig,
};
