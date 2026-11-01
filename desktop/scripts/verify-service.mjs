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

const data = await mkdtemp(join(tmpdir(), 'tavi-package-check-'));
let output = '';
let spawnError;
const startedAt = Date.now();
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
let base;
let boundPort;
try {
  let healthy = false;
  for (let attempt = 0; attempt < 300; attempt++) {
    if (spawnError) throw spawnError;
    if (child.exitCode !== null) throw new Error(`Bundled service exited: ${output}`);
    const ready = /^TAVI_READY (.+)$/m.exec(output);
    if (ready) {
      const payload = JSON.parse(ready[1]);
      if (Number.isInteger(payload.port) && payload.port > 0 && payload.port <= 65535) {
        boundPort = payload.port;
        base = `http://127.0.0.1:${boundPort}`;
      }
    }
    if (!base) {
      await delay(200);
      continue;
    }
    try {
      healthy = (await fetch(base + '/api/health', { signal: AbortSignal.timeout(1000) })).ok;
    } catch {
      /* Service is starting. */
    }
    if (healthy) break;
    await delay(200);
  }
  assert(healthy, `Bundled service did not become healthy: ${output}`);
  console.log(`Service startup: ${Date.now() - startedAt} ms`);
  assert.notEqual(boundPort, port, 'The occupied preferred port must trigger fallback');
  assert(reservation.listening, 'The existing listener must remain untouched');
  for (const path of ['/studio', '/overlay', '/dock', '/download']) {
    const response = await fetch(base + path);
    assert.equal(response.status, 200, path);
    assert.match(await response.text(), /<div id="root">/);
  }
  const state = await (await fetch(base + '/api/state')).json();
  assert.equal(state.config.character, 'tavi-foundation');
  console.log(
    `PASS native ${process.platform}-${process.arch} bundled runtime, occupied-port fallback, session readiness, Studio/overlay routes, Foundation default, and notices`,
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
  await new Promise((resolve, reject) =>
    reservation.close((error) => (error ? reject(error) : resolve())),
  );
  await rm(data, { recursive: true, force: true });
}
