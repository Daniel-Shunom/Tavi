import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { testScopes } from './ci/scopes.ts';

const args = process.argv.slice(2);
const selected = [];
const forwarded = [];
for (let index = 0; index < args.length; index++) {
  if (args[index] === '--scope') selected.push(args[++index]);
  else if (args[index] === '--scopes-from-env')
    selected.push(...JSON.parse(process.env.TAVI_TEST_SCOPES ?? '[]'));
  else forwarded.push(args[index]);
}
if (selected.some((scope) => !testScopes.includes(scope))) throw new Error('Unknown test scope.');
if (args.includes('--scopes-from-env') && !selected.length)
  throw new Error('CI selected no test suites.');
const scopes = selected.length ? [...new Set(selected)] : [...testScopes];
const root = fileURLToPath(new URL('../', import.meta.url));
function run(command, values) {
  const result = spawnSync(command, values, { cwd: root, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
console.log(`Test suites: ${scopes.join(', ')}`);
if (scopes.includes('authoring')) run('python', ['tools/tavi-rive-lab/build.py']);
run(process.execPath, [
  'node_modules/vitest/vitest.mjs',
  'run',
  ...scopes.flatMap((scope) => ['--project', scope]),
  ...forwarded,
]);
if (scopes.includes('desktop'))
  run(process.execPath, [
    '--test',
    'desktop/scripts/platform.test.mjs',
    'desktop/scripts/notices.test.mjs',
    'desktop/scripts/updater-manifest.test.mjs',
    'desktop/scripts/youtube-client.test.mjs',
  ]);
