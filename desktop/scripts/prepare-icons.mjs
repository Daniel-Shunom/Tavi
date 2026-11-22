// The branding icon is the source for every platform, installer and browser tab.
import { spawnSync } from 'node:child_process';
import { copyFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const desktop = fileURLToPath(new URL('../', import.meta.url));
const source = fileURLToPath(new URL('../../brand/logo/tavi-icon-1024.png', import.meta.url));
const generated = join(desktop, 'src-tauri/gen/icons');
const result = spawnSync(
  process.execPath,
  [join(desktop, 'node_modules/@tauri-apps/cli/tauri.js'), 'icon', source, '--output', generated],
  { cwd: desktop, stdio: 'inherit' },
);
if (result.error) throw result.error;
if (result.status !== 0) throw new Error('Could not generate Tavi branding icons.');

const installed = join(desktop, 'src-tauri/icons');
await mkdir(installed, { recursive: true });
await copyFile(source, join(installed, 'icon.png'));
for (const name of ['32x32.png', '64x64.png', '128x128.png', '128x128@2x.png', 'icon.ico'])
  await copyFile(join(generated, name), join(installed, name));
await copyFile(
  join(generated, '64x64.png'),
  fileURLToPath(new URL('../../public/favicon.png', import.meta.url)),
);
console.log('Prepared Tavi app, installer and browser icons from brand/logo/tavi-icon-1024.png.');
