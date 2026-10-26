// Character-only export of the remix: keeps one artboard (default "lyla animation") and the root
// elements it needs, dropping the customisation UI artboards, their images and fonts.
//   node tools/mascot-remix/slim.mjs [source.rml] [target-dir] [name]
//   rive art/mascot-v2-export --once
// `slimCharacter(rml, artboard, artboardId)` is exported for variant pipelines.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/** Returns `source` with only `artboard` (whose RML id is `artboardId`). Pure. */
export function slimCharacter(source, artboard = 'lyla animation', artboardId = '0:2') {
  let rml = source;
  /** Removes a whole element (with nesting) starting at `start`. */
  const cut = (start) => {
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
  };
  const other = new RegExp(`<Artboard [^>]*name="(?!${artboard}")[^"]*"`);
  for (let match = other.exec(rml); match; match = other.exec(rml)) cut(match.index);
  // Component assets that pointed at the removed artboards.
  rml = rml.replace(
    new RegExp(`\\n[ \\t]*<ComponentAsset artboardId="(?!${artboardId}")[^"]*"[^>]*\\/>`, 'g'),
    '',
  );
  for (const tag of ['ImageAsset', 'FontAsset'])
    for (let index = rml.search(new RegExp(`<${tag}\\b`)); index >= 0;) {
      cut(index);
      index = rml.search(new RegExp(`<${tag}\\b`));
    }
  return rml;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const source = process.argv[2] ?? 'art/mascot-remix/scene.rml';
  const target = process.argv[3] ?? 'art/mascot-v2-export';
  const name = process.argv[4] ?? 'mascot-v2';
  const rml = slimCharacter(readFileSync(source, 'utf8'));
  mkdirSync(target, { recursive: true });
  writeFileSync(`${target}/scene.rml`, rml);
  writeFileSync(
    `${target}/rive.yaml`,
    `name: ${name}\nlogs:\n  file: build/rive.log\n  problems: build/problems.log\nmain: "lyla animation"\n`,
  );
  writeFileSync(`${target}/.gitignore`, 'build/\n');
  console.log(`wrote ${target}/scene.rml (${String(Math.round(rml.length / 1024))} KB)`);
}
