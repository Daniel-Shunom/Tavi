// Builds the Windows installer and prints its path, size, and SHA-256.
// desktop/package.json is the single source of the app version (tauri.conf.json reads it);
// Cargo.toml must match so the executable's file version agrees.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, stat, writeFile } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const desktop = fileURLToPath(new URL('../', import.meta.url));
const { version } = JSON.parse(await readFile(join(desktop, 'package.json'), 'utf8'));
const cargo = await readFile(join(desktop, 'src-tauri', 'Cargo.toml'), 'utf8');
const cargoVersion = /^version\s*=\s*"([^"]+)"/m.exec(cargo)?.[1];
if (cargoVersion !== version)
  throw new Error(
    `Version mismatch: desktop/package.json is ${version}, src-tauri/Cargo.toml is ${cargoVersion}.`,
  );

const cli = join(desktop, 'node_modules', '@tauri-apps', 'cli', 'tauri.js');
const result = spawnSync(process.execPath, [cli, 'build', ...process.argv.slice(2)], {
  cwd: desktop,
  stdio: 'inherit',
});
if (result.status !== 0) process.exit(result.status ?? 1);

const installer = join(
  desktop,
  'src-tauri',
  'target',
  'release',
  'bundle',
  'nsis',
  `Tavi Studio_${version}_x64-setup.exe`,
);
const { size } = await stat(installer);
const hash = createHash('sha256');
for await (const chunk of createReadStream(installer)) hash.update(chunk);
const sha256 = hash.digest('hex');
await writeFile(`${installer}.sha256`, `${sha256}  Tavi Studio_${version}_x64-setup.exe\n`);
console.log('\nTavi Studio installer');
console.log(`  path:    ${installer}`);
console.log(`  (repo):  desktop/${relative(desktop, installer).replaceAll('\\', '/')}`);
console.log(`  size:    ${(size / 1024 / 1024).toFixed(1)} MiB (${size} bytes)`);
console.log(`  sha256:  ${sha256}`);
console.log('  signing: unsigned (Windows SmartScreen will warn; see desktop/README.md)');
