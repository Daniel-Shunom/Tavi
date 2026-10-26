// Character registry. Pure data: safe to import from the service, the studio and tests.
// To add a character, create characters/<id>/manifest.ts and list it here (see README.md).
import type { CharacterCatalog } from '../../../shared/capabilities';
import { capabilitiesOf, manifestSchema, type CharacterManifest } from './manifest';
import { mascot } from './mascot/manifest';

const manifests: CharacterManifest[] = [mascot].map((input) => manifestSchema.parse(input));
export const defaultCharacterId = 'mascot';
export const characters: ReadonlyMap<string, CharacterManifest> = new Map(
  manifests.map((manifest) => [manifest.id, manifest]),
);
export function getCharacter(id: string): CharacterManifest {
  const found = characters.get(id) ?? characters.get(defaultCharacterId);
  if (!found) throw new Error('No characters are registered.');
  return found;
}
export const catalog: CharacterCatalog = Object.fromEntries(
  manifests.map((manifest) => [manifest.id, capabilitiesOf(manifest)]),
);
