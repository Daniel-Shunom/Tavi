// Build native installers, stage the distributable files, and record SHA-256 checksums.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, readdir, stat, writeFile, mkdir, cp, rm } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { desktopPlatform } from './platform.mjs';
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
if (process.env.GITHUB_REF_TYPE === 'tag' && process.env.GITHUB_REF_NAME !== `v${version}`)
  throw new Error(`Release tag must match the app version: v${version}`);
const cli = join(desktop, 'node_modules', '@tauri-apps', 'cli', 'tauri.js');
const result = spawnSync(process.execPath, [cli, 'build', ...args], {
  cwd: desktop,
  stdio: 'inherit',
});
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);

const stage = resolve(desktop, 'release-assets');
if (dirname(stage) !== resolve(desktop)) throw new Error('Invalid release staging directory.');
await rm(stage, { recursive: true, force: true });
await mkdir(stage, { recursive: true });
const extensions = { nsis: '-setup.exe', deb: '.deb', appimage: '.AppImage', dmg: '.dmg' };
for (const bundle of platform.bundles) {
  const folder = join(desktop, 'src-tauri', 'target', 'release', 'bundle', bundle);
  const files = (await readdir(folder)).filter(
    (name) => name.includes(version) && name.endsWith(extensions[bundle]),
  );
  if (!files.length) throw new Error(`No ${bundle} installer was produced for ${version}.`);
  for (const name of files) {
    const file = join(folder, name);
    const hash = createHash('sha256');
    for await (const chunk of createReadStream(file)) hash.update(chunk);
    const sha256 = hash.digest('hex');
    await cp(file, join(stage, name));
    await writeFile(join(stage, `${name}.sha256`), `${sha256}  ${name}\n`);
    console.log(
      `${name}: ${((await stat(file)).size / 1024 / 1024).toFixed(1)} MiB, SHA-256 ${sha256}`,
    );
  }
}
console.log(
  `Installers staged in ${stage}. Windows is unsigned; macOS uses ad-hoc signing without notarization.`,
);
