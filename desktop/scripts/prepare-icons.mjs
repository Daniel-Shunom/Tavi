// Generate the macOS icon from the committed Tavi app icon; preserve the Windows sources.
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
if (process.platform === 'darwin') {
  const desktop = fileURLToPath(new URL('../', import.meta.url));
  const result = spawnSync(
    process.execPath,
    [
      join(desktop, 'node_modules/@tauri-apps/cli/tauri.js'),
      'icon',
      'src-tauri/icons/icon.png',
      '--output',
      'src-tauri/gen/icons',
    ],
    { cwd: desktop, stdio: 'inherit' },
  );
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
