// Updater manifest (latest.json) for Tavi Studio's in-app updater.
// Each native installer job writes one fragment (`latest-<platform>.json`) next to its signed
// update bundle; the publish job merges them into the single latest.json the app downloads from
// https://github.com/<repo>/releases/latest/download/latest.json.
import { readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const RELEASE_REPO = 'Daniel-Shunom/Tavi';

/** GitHub replaces spaces in uploaded asset names with dots; stage them that way up front. */
export function publishedName(name) {
  return name.replaceAll(' ', '.');
}

export function releaseUrl(version, name, repo = RELEASE_REPO) {
  return `https://github.com/${repo}/releases/download/v${version}/${encodeURIComponent(publishedName(name))}`;
}

/** One platform's entry, written by the installer job that built it. */
export function fragment({ version, key, name, signature }) {
  if (!signature.trim()) throw new Error(`Empty updater signature for ${key}.`);
  return {
    version,
    platforms: { [key]: { signature: signature.trim(), url: releaseUrl(version, name) } },
  };
}

/** Merges per-platform fragments; every fragment must describe the same version. */
export function merge(fragments, { notes = '', pubDate = new Date().toISOString() } = {}) {
  if (!fragments.length) throw new Error('No updater fragments to merge.');
  const versions = new Set(fragments.map((value) => value.version));
  if (versions.size !== 1)
    throw new Error(`Updater fragments disagree on version: ${[...versions].join(', ')}`);
  const platforms = {};
  for (const value of fragments)
    for (const [key, entry] of Object.entries(value.platforms)) {
      if (platforms[key]) throw new Error(`Duplicate updater platform: ${key}`);
      platforms[key] = entry;
    }
  return { version: fragments[0].version, notes, pub_date: pubDate, platforms };
}

// CLI: node updater-manifest.mjs <release-assets-dir> [expected platform count]
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const dir = process.argv[2];
  const expected = Number(process.argv[3] ?? 0);
  if (!dir) throw new Error('Usage: node updater-manifest.mjs <release-assets-dir> [count]');
  const names = (await readdir(dir)).filter((name) => /^latest-.+\.json$/.test(name));
  const fragments = await Promise.all(
    names.map(async (name) => JSON.parse(await readFile(join(dir, name), 'utf8'))),
  );
  const manifest = merge(fragments, {
    notes: `Tavi Studio v${fragments[0]?.version ?? ''}`,
  });
  if (expected && Object.keys(manifest.platforms).length !== expected)
    throw new Error(
      `Expected ${String(expected)} updater platforms, got ${Object.keys(manifest.platforms).join(', ')}`,
    );
  await writeFile(join(dir, 'latest.json'), JSON.stringify(manifest, null, 2) + '\n');
  await Promise.all(names.map((name) => rm(join(dir, name))));
  console.log(
    `latest.json: v${manifest.version} for ${Object.keys(manifest.platforms).join(', ')}`,
  );
}
