// Renders every brand still (src/brand/Brand.tsx) into ../brand/, bundling once.
// Twitch emotes are rendered at 448 px and downsampled to 112/56/28 by capture/emote-sizes.py.
// Usage, from video/: node capture/render-brand.mjs [id-filter]
import { bundle } from '@remotion/bundler';
import { getCompositions, renderStill } from '@remotion/renderer';
import { mkdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const outDir = resolve(root, '..', 'brand');
const filter = process.argv[2] ?? '';

const serveUrl = await bundle({ entryPoint: join(root, 'src', 'index.ts'), publicDir: join(root, 'public') });
const stills = (await getCompositions(serveUrl)).filter((c) => c.defaultProps?.out && c.id.includes(filter));
for (const composition of stills) {
  const { out, scale } = composition.defaultProps;
  const output = join(outDir, out);
  await mkdir(dirname(output), { recursive: true });
  await renderStill({ composition, serveUrl, output, imageFormat: 'png', scale, overwrite: true });
  console.log('wrote', out);
}
