// Resolves a manifest's asset file name to a bundled URL. Browser/Vite only; the service never
// loads artwork, so manifests themselves stay plain data.
import type { CharacterManifest } from './manifest';
const files = import.meta.glob<string>('./*/*.riv', {
  query: '?url',
  import: 'default',
  eager: true,
});
export function assetUrl(manifest: CharacterManifest) {
  // Foundation is a motion policy over the exact same licensed art, not a copied binary.
  const source = manifest.assetSource ?? manifest.id;
  const url = files[`./${source}/${manifest.asset}`];
  if (!url) throw new Error(`Missing artwork for character ${manifest.id}.`);
  return url;
}
