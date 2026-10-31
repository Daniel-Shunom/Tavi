// Desktop entry point: leave the shared service and frontend owned by the main task untouched.
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import staticFiles from '@fastify/static';
import { createApp } from '../server/app.js';
import { configSchema, defaults } from '../shared/protocol.js';
const directory = resolve(process.env['TAVI_DATA_DIR'] ?? '.data');
// 4318 is the documented OBS overlay port. TAVI_PORT exists for testing and port conflicts.
const port = Number(process.env['TAVI_PORT'] ?? 4318);
const version = process.env['TAVI_VERSION'] ?? 'development';
let config = defaults;
try {
  config = configSchema.parse(
    JSON.parse(await readFile(resolve(directory, 'character.json'), 'utf8')),
  );
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== 'ENOENT')
    console.warn('Could not read saved character; using defaults.');
}
const app = await createApp(
  config,
  async (value) => {
    await mkdir(directory, { recursive: true });
    await writeFile(resolve(directory, 'character.tmp'), JSON.stringify(value, null, 2));
    await rename(resolve(directory, 'character.tmp'), resolve(directory, 'character.json'));
  },
  {},
  [`http://127.0.0.1:${String(port)}`, `http://localhost:${String(port)}`],
);
await app.register(staticFiles, {
  root: resolve(dirname(fileURLToPath(import.meta.url)), 'dist'),
});
for (const page of ['/studio', '/overlay', '/dock'])
  app.get(page, async (_, reply) => reply.sendFile('index.html'));
await app.listen({ host: '127.0.0.1', port });
console.log(
  `${new Date().toISOString()} Tavi Studio ${version} service (Node ${process.version}): http://127.0.0.1:${String(port)} data=${directory}`,
);
for (const signal of ['SIGINT', 'SIGTERM'] as const)
  process.on(signal, () => {
    void app.close().then(() => process.exit(0));
  });
