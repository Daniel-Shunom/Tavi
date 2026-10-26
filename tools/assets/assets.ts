// Attachment authoring CLI. Run with `npx tsx tools/assets/assets.ts <command>`.
//   validate                      Validate assets/catalog.json and every assets/items/*.json.
//   svg [id...]                   Export specs as standalone SVGs (default tints) into
//                                 test-results/assets/svg/ for a quick look without the character.
//   import <file.svg> <id> <slot> Convert a simple SVG (paths with fill/stroke) into a spec
//                                 skeleton at assets/items/<id>.json; tune anchor/size in preview.
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { parseCatalog } from '../../src/renderer/attachments/catalog';
import { resolvePaint } from '../../src/renderer/attachments/layer';
import {
  AttachmentSpec,
  SlotId,
  type AttachmentSpecInput,
} from '../../src/renderer/attachments/schema';

async function readItems() {
  const items: Record<string, unknown> = {};
  for (const file of await readdir('assets/items'))
    if (file.endsWith('.json'))
      items['assets/items/' + file] = JSON.parse(await readFile('assets/items/' + file, 'utf8'));
  return items;
}

async function validate() {
  const catalog: unknown = JSON.parse(await readFile('assets/catalog.json', 'utf8'));
  const { items, catalog: parsed } = parseCatalog(catalog, await readItems());
  const counts = new Map<string, number>();
  for (const entry of parsed.items) counts.set(entry.status, (counts.get(entry.status) ?? 0) + 1);
  console.log(
    `OK: ${String(items.size)} item specs; catalog ${[...counts].map(([k, v]) => `${k} ${String(v)}`).join(', ')}`,
  );
  return items;
}

function toSvg(spec: AttachmentSpec) {
  const [x, y, w, h] = spec.viewBox;
  const body = spec.layers
    .map((layer) => {
      const fill = layer.fill ? resolvePaint(layer.fill, spec, {}, {}) : 'none';
      const stroke = layer.stroke
        ? ` stroke="${resolvePaint(layer.stroke, spec, {}, {})}" stroke-width="${String(layer.strokeWidth ?? 2)}" stroke-linecap="round" stroke-linejoin="round"`
        : '';
      const rule = layer.evenOdd ? ' fill-rule="evenodd"' : '';
      return `  <path d="${layer.d}" fill="${fill}"${stroke}${rule}${layer.behind ? ' data-behind="true"' : ''}/>`;
    })
    .join('\n');
  const [ax, ay] = spec.anchor;
  const anchor = `  <circle cx="${String(ax)}" cy="${String(ay)}" r="${String(w / 100)}" fill="#00c853" data-anchor="true"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${[x, y, w, h].join(' ')}" width="${String(w * 3)}" height="${String(h * 3)}">\n${body}\n${anchor}\n</svg>\n`;
}

async function exportSvg(ids: string[]) {
  const items = await validate();
  await mkdir('test-results/assets/svg', { recursive: true });
  for (const spec of items.values())
    if (!ids.length || ids.includes(spec.id))
      await writeFile(`test-results/assets/svg/${spec.id}.svg`, toSvg(spec));
  console.log('Wrote test-results/assets/svg/');
}

const attr = (tag: string, name: string) => new RegExp(`\\s${name}="([^"]*)"`).exec(tag)?.[1];

async function importSvg(file: string, id: string, slot: string) {
  const svg = await readFile(file, 'utf8');
  const viewBox = (attr(/<svg[^>]*>/.exec(svg)?.[0] ?? '', 'viewBox') ?? '0 0 100 100')
    .split(/[\s,]+/)
    .map(Number) as [number, number, number, number];
  const layers: AttachmentSpecInput['layers'] = [];
  const tints: Record<string, { label: string; default: string }> = {};
  const tintFor = (color: string | undefined) => {
    if (!color || color === 'none' || !/^#[0-9a-f]{6}$/i.test(color)) return undefined;
    const name = 'c' + String(Object.keys(tints).length + 1);
    const existing = Object.entries(tints).find(([, t]) => t.default === color.toLowerCase());
    if (existing) return { tint: existing[0] };
    tints[name] = { label: 'Colour ' + name.slice(1), default: color.toLowerCase() };
    return { tint: name };
  };
  for (const tag of svg.match(/<path\b[^>]*>/g) ?? []) {
    const d = attr(tag, 'd');
    if (!d) continue;
    const fill = tintFor(attr(tag, 'fill') ?? '#000000');
    const stroke = tintFor(attr(tag, 'stroke'));
    const width = Number(attr(tag, 'stroke-width') ?? 0);
    layers.push({ d, ...(fill && { fill }), ...(stroke && { stroke, strokeWidth: width || 2 }) });
  }
  if (/<(circle|rect|ellipse|polygon|use|image|linearGradient|radialGradient)\b/.test(svg))
    console.warn(
      'Warning: only <path> elements were imported; convert shapes/gradients to paths first.',
    );
  const spec: AttachmentSpecInput = {
    id,
    name: id,
    category: 'prop',
    slot: SlotId.parse(slot),
    viewBox,
    anchor: [viewBox[0] + viewBox[2] / 2, viewBox[1] + viewBox[3] / 2],
    size: 0.5,
    tints,
    layers,
  };
  AttachmentSpec.parse(spec);
  await writeFile(`assets/items/${id}.json`, JSON.stringify(spec, null, 2) + '\n');
  console.log(
    `Wrote assets/items/${id}.json with ${String(layers.length)} layers. Add a catalog entry, then tune anchor/size/category in the preview.`,
  );
}

const [command, ...rest] = process.argv.slice(2);
if (command === 'validate') await validate();
else if (command === 'svg') await exportSvg(rest);
else if (command === 'import' && rest.length === 3)
  await importSvg(rest[0] ?? '', rest[1] ?? '', rest[2] ?? '');
else {
  console.error(
    'Usage: tsx tools/assets/assets.ts validate | svg [id...] | import <file.svg> <id> <slot>',
  );
  process.exitCode = 1;
}
