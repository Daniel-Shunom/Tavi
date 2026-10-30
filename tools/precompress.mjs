// Writes Brotli and gzip copies of the build's compressible files, so the service can send them
// pre-compressed (@fastify/static `preCompressed`). Runs after `vite build`; Node built-ins only.
import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { brotliCompressSync, constants, gzipSync } from 'node:zlib';

const root = process.argv[2] ?? 'dist';
// Fonts (woff/woff2) and images are already compressed; .riv artwork and wasm compress well.
const compressible = /\.(?:js|mjs|css|html|svg|json|txt|md|wasm|riv)$/;

async function* files(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* files(path);
    else yield path;
  }
}

let before = 0,
  after = 0;
for await (const path of files(root)) {
  if (!compressible.test(path) || (await stat(path)).size < 1024) continue;
  const data = await readFile(path);
  const br = brotliCompressSync(data, {
    params: {
      [constants.BROTLI_PARAM_QUALITY]: 11,
      [constants.BROTLI_PARAM_SIZE_HINT]: data.length,
    },
  });
  await writeFile(`${path}.br`, br);
  await writeFile(`${path}.gz`, gzipSync(data, { level: 9 }));
  before += data.length;
  after += br.length;
}
console.log(
  `precompressed ${(before / 1e6).toFixed(2)} MB -> ${(after / 1e6).toFixed(2)} MB (brotli)`,
);
