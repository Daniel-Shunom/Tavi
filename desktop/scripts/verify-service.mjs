import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';
import { desktopPlatform } from './platform.mjs';

const desktop = fileURLToPath(new URL('../', import.meta.url));
const resources = process.argv[2] ? resolve(process.argv[2]) : join(desktop, 'resources');
const runtime = join(resources, 'runtime', desktopPlatform().node);
const service = join(resources, 'service/server.mjs');
await Promise.all([
  access(runtime),
  access(service),
  access(join(resources, 'THIRD-PARTY-NOTICES.txt')),
]);
const reservation = createServer();
await new Promise((resolve, reject) => {
  reservation.once('error', reject);
  reservation.listen(0, '127.0.0.1', resolve);
});
const port = reservation.address().port;
await new Promise((resolve, reject) =>
  reservation.close((error) => (error ? reject(error) : resolve())),
);
const data = await mkdtemp(join(tmpdir(), 'tavi-package-check-'));
let output = '';
let spawnError;
const child = spawn(runtime, [service], {
  cwd: join(resources, 'service'),
  env: {
    ...process.env,
    TAVI_PORT: String(port),
    TAVI_DATA_DIR: data,
    TAVI_PARENT_PID: String(process.pid),
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});
const exited = new Promise((resolve) => child.once('exit', resolve));
child.on('error', (error) => {
  spawnError = error;
});
for (const stream of [child.stdout, child.stderr])
  stream.on('data', (chunk) => {
    output = (output + String(chunk)).slice(-8000);
  });
const base = `http://127.0.0.1:${port}`;
try {
  let healthy = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    if (spawnError) throw spawnError;
    if (child.exitCode !== null) throw new Error(`Bundled service exited: ${output}`);
    try {
      healthy = (await fetch(base + '/api/health', { signal: AbortSignal.timeout(1000) })).ok;
    } catch {
      /* Service is starting. */
    }
    if (healthy) break;
    await delay(200);
  }
  assert(healthy, `Bundled service did not become healthy: ${output}`);
  for (const path of ['/studio', '/overlay', '/dock', '/download']) {
    const response = await fetch(base + path);
    assert.equal(response.status, 200, path);
    assert.match(await response.text(), /<div id="root">/);
  }
  const state = await (await fetch(base + '/api/state')).json();
  assert.equal(state.config.character, 'tavi-foundation');
  console.log(
    `PASS native ${process.platform}-${process.arch} bundled runtime, service, Studio/overlay routes, Foundation default, and notices`,
  );
} finally {
  if (child.pid && child.exitCode === null) {
    child.kill();
    await Promise.race([exited, delay(5000, undefined, { ref: false })]);
    if (child.exitCode === null) {
      child.kill('SIGKILL');
      await exited;
    }
  }
  await rm(data, { recursive: true, force: true });
}
