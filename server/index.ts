import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import staticFiles from '@fastify/static';
import { createApp } from './app.js';
import { AiManager, selectionSchema, settingsFromEnv } from './ai/manager.js';
import { configSchema, defaults } from '../shared/protocol.js';
const directory = resolve('.data');
let config = defaults;
try {
  // configSchema migrates earlier (unversioned) saved characters.
  config = configSchema.parse(
    JSON.parse(await readFile(resolve(directory, 'character.json'), 'utf8')),
  );
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== 'ENOENT')
    console.warn(
      'Saved character could not be loaded; using defaults. Original file is preserved until your next change.',
    );
}
async function atomicWrite(name: string, value: unknown) {
  await mkdir(directory, { recursive: true });
  await writeFile(resolve(directory, name + '.tmp'), JSON.stringify(value, null, 2));
  await rename(resolve(directory, name + '.tmp'), resolve(directory, name));
}
// Provider credentials come from the environment only. The saved file holds the non-secret
// provider/model choice made in the studio.
const port = Number(process.env['TAVI_PORT'] ?? 4318);
const ai = new AiManager(settingsFromEnv());
try {
  const saved = JSON.parse(await readFile(resolve(directory, 'ai.json'), 'utf8')) as Record<
    string,
    unknown
  >;
  const provider = selectionSchema.shape.provider.safeParse(saved['provider']);
  if (provider.success) {
    for (const id of ['openai', 'anthropic'] as const) {
      const model = saved[id === 'openai' ? 'openaiModel' : 'anthropicModel'];
      const parsed = selectionSchema.safeParse({
        provider: id,
        ...(typeof model === 'string' ? { model } : {}),
      });
      if (parsed.success) ai.select(parsed.data);
    }
    const baseUrl = saved['openaiBaseUrl'];
    const base = selectionSchema.safeParse({
      provider: 'openai',
      ...(typeof baseUrl === 'string' ? { baseUrl } : {}),
    });
    if (base.success) ai.select(base.data);
    ai.select({ provider: provider.data });
  }
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== 'ENOENT')
    console.warn('Saved AI selection ignored.');
}
const app = await createApp(
  config,
  async (value) => {
    await atomicWrite('character.json', value);
  },
  {},
  [`http://127.0.0.1:${String(port)}`, `http://localhost:${String(port)}`],
  {
    ai,
    saveAi: async (selection) => {
      await atomicWrite('ai.json', selection);
    },
  },
);
if (existsSync(resolve('dist/index.html'))) {
  await app.register(staticFiles, {
    root: resolve('dist'),
    // `npm run build` writes .br/.gz copies (tools/precompress.mjs); hashed assets never change.
    preCompressed: true,
    cacheControl: false,
    setHeaders: (response, path) => {
      response.header(
        'cache-control',
        /[\\/]assets[\\/]/.test(path) ? 'public, max-age=31536000, immutable' : 'no-cache',
      );
    },
  });
  app.get('/rig-lab', async (_, reply) => reply.sendFile('index.html'));
  app.get('/studio', async (_, reply) => reply.sendFile('index.html'));
  app.get('/overlay', async (_, reply) => reply.sendFile('index.html'));
  app.get('/dock', async (_, reply) => reply.sendFile('index.html'));
}
try {
  await app.listen({ host: '127.0.0.1', port });
  console.log(`Tavi service: http://127.0.0.1:${String(port)} (decisions: ${ai.active.label})`);
} catch (error) {
  console.error(error);
  process.exit(1);
}
for (const signal of ['SIGINT', 'SIGTERM'] as const)
  process.on(signal, () => {
    void app.close().then(() => process.exit(0));
  });
