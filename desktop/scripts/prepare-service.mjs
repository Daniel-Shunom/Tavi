// Generates desktop/resources/ (gitignored): the built studio/overlay, the bundled service,
// its production dependencies, a Node runtime, and third-party notices.
import { build } from 'esbuild';
import { mkdir, readFile, writeFile, copyFile, cp, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { collectNotices } from './notices.mjs';

const desktop = fileURLToPath(new URL('../', import.meta.url));
const root = fileURLToPath(new URL('../../', import.meta.url));
if (process.platform !== 'win32' || process.arch !== 'x64')
  throw new Error('The desktop package supports Windows x64 only.');

function runNode(args, cwd) {
  const result = spawnSync(process.execPath, args, { cwd, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Build step failed (${result.status}): ${args[0]}`);
}

const { version } = JSON.parse(await readFile(join(desktop, 'package.json'), 'utf8'));
const resources = join(desktop, 'resources');
const service = join(resources, 'service');
const runtime = join(resources, 'runtime');
// Start clean so files removed from the app never linger in an installer.
await rm(resources, { recursive: true, force: true });
await mkdir(service, { recursive: true });
await mkdir(runtime, { recursive: true });

runNode(['node_modules/typescript/bin/tsc', '--noEmit'], root);
runNode(['node_modules/typescript/bin/tsc', '--noEmit', '-p', 'desktop/tsconfig.json'], root);
runNode(['node_modules/vite/bin/vite.js', 'build'], root);

const result = await build({
  entryPoints: [join(desktop, 'service.ts')],
  outfile: join(service, 'server.mjs'),
  bundle: true,
  packages: 'external',
  platform: 'node',
  target: 'node22',
  format: 'esm',
  metafile: true,
});

// Install exactly the packages the bundled service imports, at the root's declared ranges,
// so new server dependencies cannot silently go missing from the installer.
const manifest = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
const packageName = (path) =>
  path.startsWith('@') ? path.split('/').slice(0, 2).join('/') : path.split('/')[0];
const imported = new Set();
for (const output of Object.values(result.metafile.outputs))
  for (const { path, external } of output.imports)
    if (external && !path.startsWith('node:')) imported.add(packageName(path));
const dependencies = {};
for (const name of [...imported].sort()) {
  const range = manifest.dependencies?.[name];
  if (!range) throw new Error(`Service imports "${name}", which is not a root dependency.`);
  dependencies[name] = range;
}
console.log(`Service dependencies: ${Object.keys(dependencies).join(', ')}`);
await writeFile(
  join(service, 'package.json'),
  JSON.stringify(
    { name: 'tavi-bundled-service', version, private: true, type: 'module', dependencies },
    null,
    2,
  ),
);
// Reuse the root lockfile's resolved versions where possible.
await copyFile(join(root, 'package-lock.json'), join(service, 'package-lock.json'));
// Invoke npm's JS CLI directly so Windows shell quoting does not affect installation.
const npmCli = process.env.npm_execpath;
if (!npmCli) throw new Error('Run packaging through npm (npm run build / npm run release).');
runNode(
  [npmCli, 'install', '--omit=dev', '--ignore-scripts', '--no-audit', '--no-fund'],
  service,
);
await cp(join(root, 'dist'), join(service, 'dist'), { recursive: true });

await copyFile(process.execPath, join(runtime, 'node.exe'));
const nodeLicense = join(dirname(process.execPath), 'LICENSE');
try {
  await copyFile(nodeLicense, join(runtime, 'NODE-LICENSE.txt'));
} catch {
  throw new Error(
    'Node LICENSE was not found next to node.exe. Add the official runtime LICENSE before distributing.',
  );
}

await writeFile(
  join(resources, 'THIRD-PARTY-NOTICES.txt'),
  await collectNotices({ root, service, nodeLicense, nodeVersion: process.version, version }),
);
console.log(`Prepared Tavi Studio ${version} resources (Node ${process.version}).`);
