// Writes a character-only copy of the remix project to art/mascot-v2-export/: the "lyla
// animation" artboard and the root elements it needs, without the customisation UI artboards,
// their images and fonts. Build it with `rive art/mascot-v2-export --once`.
//   node tools/mascot-remix/slim.mjs
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const source = 'art/mascot-remix/scene.rml';
const target = 'art/mascot-v2-export';
let rml = readFileSync(source, 'utf8');

/** Removes a whole element (with nesting) starting at `start`. */
function cut(start) {
  const tag = /<([A-Za-z]+)/.exec(rml.slice(start))?.[1];
  const head = rml.indexOf('>', start);
  if (rml[head - 1] === '/') {
    rml = rml.slice(0, start) + rml.slice(head + 1);
    return;
  }
  let depth = 0;
  const re = new RegExp(`<(/?)${tag}\\b[^>]*?(/?)>`, 'g');
  re.lastIndex = start;
  for (let m = re.exec(rml); m; m = re.exec(rml)) {
    if (m[2] === '/') continue;
    depth += m[1] ? -1 : 1;
    if (depth === 0) {
      rml = rml.slice(0, start) + rml.slice(m.index + m[0].length);
      return;
    }
  }
  throw new Error('unbalanced ' + String(tag));
}

for (;;) {
  const match = /<Artboard [^>]*name="(?!lyla animation")[^"]*"/.exec(rml);
  if (!match) break;
  cut(match.index);
}
// Component assets that pointed at the removed artboards.
rml = rml.replace(/\n[ \t]*<ComponentAsset artboardId="(?!0:2")[^"]*"[^>]*\/>/g, '');
for (const tag of ['ImageAsset', 'FontAsset']) {
  for (;;) {
    const index = rml.search(new RegExp(`<${tag}\\b`));
    if (index < 0) break;
    cut(index);
  }
}
mkdirSync(target, { recursive: true });
writeFileSync(`${target}/scene.rml`, rml);
writeFileSync(
  `${target}/rive.yaml`,
  'name: mascot-v2\nlogs:\n  file: build/rive.log\n  problems: build/problems.log\nmain: "lyla animation"\n',
);
writeFileSync(`${target}/.gitignore`, 'build/\n');
console.log(`wrote ${target}/scene.rml (${String(Math.round(rml.length / 1024))} KB)`);
