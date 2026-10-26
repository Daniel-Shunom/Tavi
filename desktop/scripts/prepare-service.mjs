import {build} from 'esbuild';
import {mkdir, readFile, writeFile, copyFile, cp} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {join, dirname} from 'node:path';
const desktop = fileURLToPath(new URL('../', import.meta.url));
const root = fileURLToPath(new URL('../../', import.meta.url));
if (process.platform !== 'win32' || process.arch !== 'x64') throw new Error('The initial desktop package supports Windows x64 only.');
function runNode(args, cwd) {
  const result = spawnSync(process.execPath, args, {cwd, stdio: 'inherit'});
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Build step failed (${result.status}): ${args[0]}`);
}
runNode(['node_modules/typescript/bin/tsc', '--noEmit'], root);
runNode(['node_modules/vite/bin/vite.js', 'build'], root);
const service = join(desktop, 'resources/service');
const runtime = join(desktop, 'resources/runtime');
await mkdir(service, {recursive: true});
await mkdir(runtime, {recursive: true});
await build({entryPoints: [join(desktop, 'service.ts')], outfile: join(service, 'server.mjs'), bundle: true, packages: 'external', platform: 'node', target: 'node22', format: 'esm'});
const manifest = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
const names = ['@fastify/static', '@fastify/websocket', 'fastify', 'zod'];
const dependencies = Object.fromEntries(names.map(name => [name, manifest.dependencies[name]]));
await writeFile(join(service, 'package.json'), JSON.stringify({name: 'tavi-bundled-service', version: '0.1.0', private: true, type: 'module', dependencies}, null, 2));
// Invoke npm's JS CLI directly so Windows shell quoting does not affect installation.
const npmCli = process.env.npm_execpath;
if (!npmCli) throw new Error('Run packaging through npm run build in the desktop directory.');
runNode([npmCli, 'install', '--omit=dev', '--ignore-scripts', '--no-audit', '--no-fund'], service);
await cp(join(root, 'dist'), join(service, 'dist'), {recursive: true});
await copyFile(process.execPath, join(runtime, 'node.exe'));
// Distribute the runtime license alongside its executable.
const license = join(dirname(process.execPath), 'LICENSE');
try { await copyFile(license, join(runtime, 'NODE-LICENSE.txt')); }
catch { throw new Error('Node LICENSE was not found next to node.exe. Add the official runtime LICENSE before distributing.'); }
console.log('Prepared desktop runtime, service, and OBS frontend.');
