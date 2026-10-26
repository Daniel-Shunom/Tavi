// Loads and validates the attachment catalog (assets/catalog.json) and item specs
// (assets/items/*.json). Invalid items fail loudly in development and tests.
import catalogJson from '../../../assets/catalog.json';
import { AttachmentSpec, Catalog, type CatalogEntry } from './schema';

const itemModules = import.meta.glob<{ default: unknown }>('../../../assets/items/*.json', {
  eager: true,
});

export interface LoadedCatalog {
  catalog: Catalog;
  items: ReadonlyMap<string, AttachmentSpec>;
}

export function parseCatalog(
  catalogData: unknown,
  itemData: Readonly<Record<string, unknown>>,
): LoadedCatalog {
  const catalog = Catalog.parse(catalogData);
  const items = new Map<string, AttachmentSpec>();
  for (const [file, data] of Object.entries(itemData)) {
    const result = AttachmentSpec.safeParse(data);
    if (!result.success)
      throw new Error(`Invalid attachment ${file}: ${result.error.issues.map((i) => i.path.join('.') + ' ' + i.message).join('; ')}`);
    const spec = result.data;
    const base = file.split('/').at(-1)?.replace(/\.json$/, '');
    if (base !== spec.id) throw new Error(`Attachment ${file} must be named ${spec.id}.json`);
    items.set(spec.id, spec);
  }
  const entries = new Map<string, CatalogEntry>(catalog.items.map((entry) => [entry.id, entry]));
  for (const id of items.keys()) {
    const entry = entries.get(id);
    if (!entry) throw new Error(`Attachment ${id} is missing from assets/catalog.json`);
    if (!entry.redistribution || !entry.modification)
      throw new Error(`Attachment ${id} is not licensed for redistribution and modification`);
    if (entry.slot && entry.slot !== items.get(id)?.slot)
      throw new Error(`Attachment ${id} slot disagrees with the catalog`);
  }
  for (const entry of catalog.items)
    if ((entry.status === 'ready' || entry.status === 'converted') && !items.has(entry.id))
      throw new Error(`Catalog entry ${entry.id} is ${entry.status} but has no item spec`);
  return { catalog, items };
}

let loaded: LoadedCatalog | undefined;
/** The bundled catalog, validated once. */
export function loadAttachments(): LoadedCatalog {
  loaded ??= parseCatalog(
    catalogJson,
    Object.fromEntries(Object.entries(itemModules).map(([file, module]) => [file, module.default])),
  );
  return loaded;
}

/** Items usable in a slot, for pickers. */
export function itemsForSlot(items: ReadonlyMap<string, AttachmentSpec>, slot: string) {
  return [...items.values()].filter((item) => item.slot === slot);
}
