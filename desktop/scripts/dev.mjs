import {spawn} from 'node:child_process';
import {mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const root = fileURLToPath(new URL('../../', import.meta.url));
// Ensure Tauri's resource directory exists on a fresh development checkout.
await mkdir(fileURLToPath(new URL('../resources/', import.meta.url)), {recursive: true});
// Node entry points avoid npm/cmd process trees and let Tauri clean up this owned launcher.
const processes = [
  spawn(process.execPath, ['--import', 'tsx', 'server/index.ts'], {cwd: root, stdio: 'inherit'}),
  spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1'], {cwd: root, stdio: 'inherit'}),
];
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of processes) child.kill();
  process.exitCode = code;
}
for (const child of processes) {
  child.on('error', error => { console.error(error); stop(1); });
  child.on('exit', code => stop(code ?? 1));
}
process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());
process.on('exit', () => { for (const child of processes) child.kill(); });
