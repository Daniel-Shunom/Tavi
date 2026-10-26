// Data formats for attachments: wearable/holdable vector items pinned to named character slots.
// Items are authored as JSON (assets/items/<id>.json) and validated here; nothing is hard-coded.
import { z } from 'zod';

/** Slot names shared by every character manifest. Characters may omit slots they cannot support. */
export const slotIds = [
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
export const SlotId = z.enum(slotIds);
export type SlotId = z.infer<typeof SlotId>;

export const categories = ['hat', 'hair', 'eyewear', 'headwear', 'neckwear', 'prop'] as const;

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Expected #rrggbb');
const tintName = z.string().regex(/^[a-z][a-zA-Z0-9]*$/);

/** A fill or stroke colour: a literal, or a tint slot with an optional lightness shift (-1..1). */
export const Paint = z.union([
  hex,
  z.object({
    tint: tintName,
    shade: z.number().min(-1).max(1).default(0),
    alpha: z.number().min(0).max(1).default(1),
  }),
]);
export type Paint = z.infer<typeof Paint>;

const point = z.tuple([z.number(), z.number()]);

export const Spring = z.object({
  /** Pivot in item coordinates; the layer swings around it. */
  pivot: point,
  /** Angular stiffness (1/s^2) and damping (1/s). */
  stiffness: z.number().positive().default(60),
  damping: z.number().nonnegative().default(6),
  /** How strongly slot acceleration (artboard units/s^2) swings the layer. */
  inertia: z.number().default(0.004),
  /** Clamp in degrees. */
  maxAngle: z.number().positive().default(25),
  /** 0 swings with the slot, 1 keeps hanging straight down when the slot tilts. */
  hang: z.number().min(0).max(1).default(0.6),
});
export type Spring = z.infer<typeof Spring>;

export const Layer = z.object({
  /** SVG path data in item coordinates (the item's viewBox). */
  d: z.string().min(1),
  fill: Paint.optional(),
  stroke: Paint.optional(),
  strokeWidth: z.number().positive().optional(),
  /** Draw behind the character instead of in front of it. */
  behind: z.boolean().default(false),
  /** Layers sharing a spring group swing together. */
  spring: z.string().optional(),
  /** Fill rule for cut-outs (e.g. glasses lenses). */
  evenOdd: z.boolean().default(false),
});
export type Layer = z.infer<typeof Layer>;

export const AttachmentSpec = z.object({
  id: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
  name: z.string().min(1),
  category: z.enum(categories),
  slot: SlotId,
  /** Item coordinate space [x, y, width, height]. */
  viewBox: z.tuple([z.number(), z.number(), z.number().positive(), z.number().positive()]),
  /** Point in item coordinates pinned to the slot origin. */
  anchor: point,
  /** Rendered item width as a multiple of the slot's reference size. */
  size: z.number().positive(),
  /** Extra offset in slot units (fractions of the reference size), applied after anchoring. */
  offset: point.default([0, 0]),
  rotation: z.number().default(0),
  tints: z
    .record(
      tintName,
      z.object({
        label: z.string(),
        default: hex,
        /** Follow a character palette colour (e.g. hair) unless the streamer overrides it. */
        follow: z.enum(['hair', 'outfit', 'glasses', 'skin']).optional(),
      }),
    )
    .default({}),
  springs: z.record(z.string(), Spring).default({}),
  layers: z.array(Layer).min(1),
  /** Honest notes on limits (e.g. "overlay only; does not deform with hair swing"). */
  notes: z.string().optional(),
});
export type AttachmentSpec = z.infer<typeof AttachmentSpec>;
export type AttachmentSpecInput = z.input<typeof AttachmentSpec>;

export const CatalogEntry = z.object({
  id: z.string(),
  origin: z.enum(['created', 'discovered']),
  status: z.enum(['ready', 'converted', 'candidate', 'rejected']),
  slot: SlotId.optional(),
  source: z.string().optional(),
  author: z.string(),
  license: z.string(),
  redistribution: z.boolean(),
  modification: z.boolean(),
  notes: z.string().optional(),
});
export type CatalogEntry = z.infer<typeof CatalogEntry>;
export const Catalog = z.object({
  version: z.literal(1),
  items: z.array(CatalogEntry),
});
export type Catalog = z.infer<typeof Catalog>;

/** Equipped items as stored in configuration: one item per slot. */
export const EquippedAttachments = z.partialRecord(SlotId, z.string());
export type EquippedAttachments = z.infer<typeof EquippedAttachments>;
/** Per-item tint overrides: itemId -> tint name -> #rrggbb. */
export const AttachmentTints = z.record(z.string(), z.record(z.string(), hex));
export type AttachmentTints = z.infer<typeof AttachmentTints>;

/** How a character exposes a slot: a named transform component plus an offset in its space. */
export const SlotBinding = z.object({
  /** Runtime name of the node/bone (see the character's rig patch), or null for artboard space. */
  node: z.string().nullable(),
  kind: z.enum(['node', 'bone', 'rootBone']).default('node'),
  /** Slot origin in the node's local space (artboard units). */
  offset: point.default([0, 0]),
  /** Reference size in artboard units (e.g. head width) that item `size` multiplies. */
  size: z.number().positive(),
  /** 0 keeps items upright, 1 follows the node's rotation fully. */
  follow: z.number().min(0).max(1).default(1),
  /** Extra rotation in degrees (e.g. the hand's grip angle). */
  rotation: z.number().default(0),
});
export type SlotBinding = z.infer<typeof SlotBinding>;
export const CharacterSlots = z.partialRecord(SlotId, SlotBinding);
export type CharacterSlots = z.infer<typeof CharacterSlots>;
