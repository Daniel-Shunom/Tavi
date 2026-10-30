// Desktop entry point: leave the shared service and frontend owned by the main task untouched.
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import staticFiles from '@fastify/static';
import { createApp } from '../server/app.js';
import { AiManager, selectionSchema } from '../server/ai/manager.js';
import { configSchema, defaults } from '../shared/protocol.js';
import { listenDesktop } from './listen.js';
const directory = resolve(process.env['TAVI_DATA_DIR'] ?? '.data');
// 4318 is the documented OBS overlay port. TAVI_PORT exists for testing and port conflicts.
const preferredPort = Number(process.env['TAVI_PORT'] ?? 4318);
let port = 0;
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
const ai = new AiManager();
try {
  const saved = JSON.parse(await readFile(resolve(directory, 'ai.json'), 'utf8')) as {
    provider?: unknown;
  };
  const provider = selectionSchema.shape.provider.safeParse(saved.provider);
  if (provider.success) ai.select({ provider: provider.data });
} catch {
  // First launch or invalid non-secret selection: use the default provider.
}
const app = await createApp(
  config,
  async (value) => {
    await mkdir(directory, { recursive: true });
    await writeFile(resolve(directory, 'character.tmp'), JSON.stringify(value, null, 2));
    await rename(resolve(directory, 'character.tmp'), resolve(directory, 'character.json'));
  },
  {},
  () => (port ? [`http://127.0.0.1:${String(port)}`, `http://localhost:${String(port)}`] : []),
  {
    ai,
    saveAi: async (selection) => {
      await mkdir(directory, { recursive: true });
      await writeFile(resolve(directory, 'ai.tmp'), JSON.stringify(selection));
      await rename(resolve(directory, 'ai.tmp'), resolve(directory, 'ai.json'));
    },
  },
);
await app.register(staticFiles, {
  root: resolve(dirname(fileURLToPath(import.meta.url)), 'dist'),
});
for (const route of ['/studio', '/rig-lab', '/download', '/overlay', '/dock']) {
  app.get(route, async (_, reply) => reply.sendFile('index.html'));
}
// Unix has no Windows job object. Stop the service if its shell parent disappears,
// including a force-quit/crash, so a stale service cannot keep the OBS port occupied.
const parentPid = Number(process.env['TAVI_PARENT_PID']);
if (process.platform !== 'win32' && Number.isSafeInteger(parentPid) && parentPid > 0) {
  const parentWatch = setInterval(() => {
    if (process.ppid === parentPid) return;
    clearInterval(parentWatch);
    void app.close().then(
      () => process.exit(0),
      () => process.exit(1),
    );
  }, 1000);
  parentWatch.unref();
  app.addHook('onClose', () => {
    clearInterval(parentWatch);
    return Promise.resolve();
  });
}

port = await listenDesktop(app, preferredPort);
// The native shell reads this line from its own child's stdout before opening Studio.
console.log(`TAVI_READY ${JSON.stringify({ port })}`);
console.log(
  `${new Date().toISOString()} Tavi Studio ${version} service (Node ${process.version}): http://127.0.0.1:${String(port)} data=${directory}`,
);
for (const signal of ['SIGINT', 'SIGTERM'] as const)
  process.on(signal, () => {
    void app.close().then(() => process.exit(0));
  });
