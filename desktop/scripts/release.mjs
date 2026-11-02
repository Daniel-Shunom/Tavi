// Build native installers, stage the distributable files, and record SHA-256 checksums.
// With TAURI_SIGNING_PRIVATE_KEY set (release CI), also signs the in-app update bundle and
// writes this platform's updater fragment (merged into latest.json by the publish job).
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, readdir, stat, writeFile, mkdir, cp, rm } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { desktopPlatform } from './platform.mjs';
import { fragment, publishedName } from './updater-manifest.mjs';
import './prepare-icons.mjs';

const desktop = fileURLToPath(new URL('../', import.meta.url));
const platform = desktopPlatform();
const args = process.argv.slice(2);
if (args.some((arg) => arg.startsWith('--target')) || process.env.CARGO_BUILD_TARGET)
  throw new Error(
    'Use a native build host; cross-compilation would bundle the wrong Node runtime.',
  );
const { version } = JSON.parse(await readFile(join(desktop, 'package.json'), 'utf8'));
const cargo = await readFile(join(desktop, 'src-tauri', 'Cargo.toml'), 'utf8');
const cargoVersion = /^version\s*=\s*"([^"]+)"/m.exec(cargo)?.[1];
if (cargoVersion !== version)
  throw new Error(
    `Version mismatch: desktop/package.json is ${version}, Cargo.toml is ${cargoVersion}.`,
  );
const tagged = process.env.GITHUB_REF_TYPE === 'tag';
if (tagged && process.env.GITHUB_REF_NAME !== `v${version}`)
  throw new Error(`Release tag must match the app version: v${version}`);
// Update bundles are signed only when the key is available (release CI). Local and fork builds
// stay unsigned; a tagged release without the key would ship installers that cannot update.
const sign = !!process.env.TAURI_SIGNING_PRIVATE_KEY;
if (tagged && !sign)
  throw new Error('Tagged releases must be signed: TAURI_SIGNING_PRIVATE_KEY is not set.');
const cli = join(desktop, 'node_modules', '@tauri-apps', 'cli', 'tauri.js');
const updaterConfig = JSON.stringify({ bundle: { createUpdaterArtifacts: true } });
const result = spawnSync(
  process.execPath,
  [cli, 'build', ...(sign ? ['--config', updaterConfig] : []), ...args],
  { cwd: desktop, stdio: 'inherit' },
);
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);

const stage = resolve(desktop, 'release-assets');
if (dirname(stage) !== resolve(desktop)) throw new Error('Invalid release staging directory.');
await rm(stage, { recursive: true, force: true });
await mkdir(stage, { recursive: true });
const bundleRoot = join(desktop, 'src-tauri', 'target', 'release', 'bundle');

async function stageFile(file, name) {
  const published = publishedName(name);
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  const sha256 = hash.digest('hex');
  await cp(file, join(stage, published));
  await writeFile(join(stage, `${published}.sha256`), `${sha256}  ${published}\n`);
  console.log(
    `${published}: ${((await stat(file)).size / 1024 / 1024).toFixed(1)} MiB, SHA-256 ${sha256}`,
  );
}

const extensions = { nsis: '-setup.exe', deb: '.deb', appimage: '.AppImage', dmg: '.dmg' };
for (const bundle of platform.bundles) {
  const folder = join(bundleRoot, bundle);
  const files = (await readdir(folder)).filter(
    (name) => name.includes(version) && name.endsWith(extensions[bundle]),
  );
  if (!files.length) throw new Error(`No ${bundle} installer was produced for ${version}.`);
  for (const name of files) await stageFile(join(folder, name), name);
}

if (sign) {
  const { key, bundle, suffix } = platform.updater;
  const folder = join(bundleRoot, bundle);
  const names = await readdir(folder);
  const artifact = names.find(
    (name) => name.endsWith(suffix) && (bundle === 'macos' || name.includes(version)),
  );
  if (!artifact || !names.includes(`${artifact}.sig`))
    throw new Error(`No signed ${bundle} update bundle was produced for ${version}.`);
  // macOS names its archive after the app only; add version and architecture so both Mac
  // builds can live in one release.
  const name = bundle === 'macos' ? `Tavi Studio_${version}_${key}${suffix}` : artifact;
  if (bundle === 'macos') await stageFile(join(folder, artifact), name);
  const signature = await readFile(join(folder, `${artifact}.sig`), 'utf8');
  await writeFile(
    join(stage, `latest-${key}.json`),
    JSON.stringify(fragment({ version, key, name, signature }), null, 2) + '\n',
  );
  console.log(`Updater: ${key} -> ${publishedName(name)} (signed)`);
} else console.log('Updater: unsigned build (no TAURI_SIGNING_PRIVATE_KEY); no update bundle.');
console.log(
  `Installers staged in ${stage}. Windows is unsigned; macOS uses ad-hoc signing without notarization.`,
);
