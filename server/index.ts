import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import staticFiles from '@fastify/static';
import { createApp } from './app.js';
import { configSchema, defaults } from '../shared/protocol.js';
const directory = resolve('.data');
let config = defaults;
try {
  config = configSchema.parse(
    JSON.parse(await readFile(resolve(directory, 'character.json'), 'utf8')),
  );
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== 'ENOENT')
    console.warn(
      'Saved character could not be loaded; using defaults. Original file is preserved until your next change.',
    );
}
const app = await createApp(config, async (value) => {
  await mkdir(directory, { recursive: true });
  await writeFile(resolve(directory, 'character.tmp'), JSON.stringify(value, null, 2));
  await rename(resolve(directory, 'character.tmp'), resolve(directory, 'character.json'));
});
if (existsSync(resolve('dist/index.html'))) {
  await app.register(staticFiles, { root: resolve('dist') });
  app.get('/overlay', async (_, reply) => reply.sendFile('index.html'));
}
try {
  await app.listen({ host: '127.0.0.1', port: 4318 });
  console.log('Tavi service: http://127.0.0.1:4318');
} catch (error) {
  console.error(error);
  process.exit(1);
}
for (const signal of ['SIGINT', 'SIGTERM'] as const)
  process.on(signal, () => {
    void app.close().then(() => process.exit(0));
  });
