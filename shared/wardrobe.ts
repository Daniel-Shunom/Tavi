// Wardrobe configuration: equipped attachments (one item per slot), tint overrides and custom
// hair/outfit colours. Depends only on zod so the service can validate it.
import { z } from 'zod';

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Expected #rrggbb');
export const wardrobeSlots = [
  'head.top',
  'head.face',
  'head.back',
  'head.hair',
  'head.side',
  'neck',
  'torso',
  'hand.l',
  'hand.r',
] as const;
export type WardrobeSlot = (typeof wardrobeSlots)[number];
const itemId = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/);

/** Defaults pending confirmation; change them here. */
export const wardrobePolicy: {
  eyewearHidesBuiltInGlasses: boolean;
  oneItemPerSlot: boolean;
  recolorOnCommit: boolean;
} = {
  /** Equipping eyewear (head.face) hides the character's built-in glasses. */
  eyewearHidesBuiltInGlasses: true,
  /** One item per slot (the config shape enforces this). */
  oneItemPerSlot: true,
  /** Recolours rebuild the character file when committed (a one-frame reload). */
  recolorOnCommit: true,
};

export const wardrobeSchema = z
  .object({
    /** Slot -> item id. One item per slot. */
    attachments: z.partialRecord(z.enum(wardrobeSlots), itemId),
    /** Item id -> tint name -> colour. Absent tints follow their default or palette. */
    tints: z.record(itemId, z.record(z.string().regex(/^[a-z][a-z0-9-]{0,23}$/), hex)),
    /** Custom colours that replace the hair / outfit preset colour. */
    hairColor: hex.optional(),
    outfitColor: hex.optional(),
  })
  .strict();
export type Wardrobe = z.infer<typeof wardrobeSchema>;
export const defaultWardrobe: Wardrobe = { attachments: {}, tints: {} };

/** Bundled item ids and their slots, used by the service to drop stale or unknown items. */
export type ItemCatalog = ReadonlyMap<string, WardrobeSlot>;
export function itemCatalogFrom(catalog: unknown): ItemCatalog {
  const parsed = z
    .object({
      items: z.array(
        z.object({ id: z.string(), status: z.string(), slot: z.string().optional() }).loose(),
      ),
    })
    .loose()
    .parse(catalog);
  const map = new Map<string, WardrobeSlot>();
  for (const item of parsed.items) {
    const slot = wardrobeSlots.find((value) => value === item.slot);
    if (slot && (item.status === 'ready' || item.status === 'converted')) map.set(item.id, slot);
  }
  return map;
}
export function normalizeWardrobe(wardrobe: Wardrobe, items: ItemCatalog | undefined): Wardrobe {
  if (!items) return wardrobe;
  const attachments: Wardrobe['attachments'] = {};
  for (const [slot, id] of Object.entries(wardrobe.attachments) as [WardrobeSlot, string][])
    if (items.get(id) === slot) attachments[slot] = id;
  const tints = Object.fromEntries(Object.entries(wardrobe.tints).filter(([id]) => items.has(id)));
  return { ...wardrobe, attachments, tints };
}
