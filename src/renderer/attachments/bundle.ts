// The bundled attachment catalog, loaded through Vite (import.meta.glob) and validated once.
import catalogJson from '../../../assets/catalog.json';
import { parseCatalog, type LoadedCatalog } from './catalog';

const itemModules = import.meta.glob<{ default: unknown }>('../../../assets/items/*.json', {
  eager: true,
});

let loaded: LoadedCatalog | undefined;
export function loadAttachments(): LoadedCatalog {
  loaded ??= parseCatalog(
    catalogJson,
    Object.fromEntries(Object.entries(itemModules).map(([file, module]) => [file, module.default])),
  );
  return loaded;
}
