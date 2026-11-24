// Copies the holiday illustrations Studio's holiday rooms use out of Microsoft's Fluent Emoji set
// (MIT, via the @iconify-json/fluent-emoji dev dependency) into src/studio-next/holiday/art/, so
// the app ships only the pictures it uses. Run after changing the list: node tools/holiday-art.mjs
import { mkdir, readFile, writeFile } from 'node:fs/promises';

const names = [
  // Halloween
  'jack-o-lantern',
  'ghost',
  'bat',
  'spider',
  'spider-web',
  'candle',
  'full-moon',
  'black-cat',
  // Christmas
  'christmas-tree',
  'wrapped-gift',
  'snowman',
  'snowflake',
  'bell',
  'glowing-star',
  'candy',
  'deer',
  // Valentine's Day
  'red-heart',
  'heart-with-ribbon',
  'bouquet',
  'rose',
  'love-letter',
  'balloon',
  'teddy-bear',
  'sparkling-heart',
  // St Patrick's Day
  'shamrock',
  'four-leaf-clover',
  'money-bag',
  'coin',
  'rainbow',
  'top-hat',
  // Easter
  'egg',
  'hatching-chick',
  'rabbit',
  'tulip',
  'basket',
  'cherry-blossom',
  'butterfly',
  // Harvest
  'maple-leaf',
  'fallen-leaf',
  'ear-of-corn',
  'pie',
  'chestnut',
  'mushroom',
  'sheaf-of-rice',
  'red-apple',
  // New Year
  'party-popper',
  'confetti-ball',
  'mirror-ball',
  'sparkles',
  'fireworks',
  'mantelpiece-clock',
  // Lunar New Year
  'red-paper-lantern',
  'firecracker',
  'red-envelope',
  'dragon',
  'tangerine',
  'moon-cake',
  'folding-hand-fan',
];

const set = JSON.parse(
  await readFile(new URL('../node_modules/@iconify-json/fluent-emoji/icons.json', import.meta.url)),
);
const out = new URL('../src/studio-next/holiday/art/', import.meta.url);
await mkdir(out, { recursive: true });
const missing = [];
for (const name of names) {
  const icon = set.icons[name];
  if (!icon) {
    missing.push(name);
    continue;
  }
  const width = icon.width ?? set.width ?? 32;
  const height = icon.height ?? set.height ?? 32;
  await writeFile(
    new URL(`${name}.svg`, out),
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${String(width)} ${String(height)}">${icon.body}</svg>\n`,
  );
}
await writeFile(
  new URL('CREDITS.md', out),
  `# Holiday illustrations

These pictures are from Microsoft's Fluent Emoji (https://github.com/microsoft/fluentui-emoji),
used under the MIT License, copied here by \`tools/holiday-art.mjs\`.

MIT License. Copyright (c) Microsoft Corporation.

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and
associated documentation files (the "Software"), to deal in the Software without restriction,
including without limitation the rights to use, copy, modify, merge, publish, distribute,
sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or
substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT
NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
`,
);
if (missing.length) throw new Error(`Not in the set: ${missing.join(', ')}`);
console.log(`Copied ${String(names.length)} illustrations.`);
