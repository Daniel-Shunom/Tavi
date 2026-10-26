// Fails if renderer-specific names (clip, artboard, state machine, input, node names from any
// character manifest) appear as string literals outside src/renderer/characters/**.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { expect, it } from 'vitest';
import { expressionIds, sequenceIds } from '../shared/expressions';
import { manifestSchema } from '../src/renderer/characters/manifest';
import { characters } from '../src/renderer/characters/registry';
import { testCharacter } from './fixtures/test-character';

function files(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) return files(path);
    return /\.(ts|tsx|mjs|js)$/.test(name) ? [path] : [];
  });
}
it('keeps renderer-specific names inside character manifests', () => {
  const manifests = [...characters.values(), manifestSchema.parse(testCharacter)];
  const abstract = new Set<string>([...expressionIds, ...sequenceIds]);
  const names = new Set<string>();
  for (const manifest of manifests) {
    for (const value of [
      manifest.artboard,
      manifest.stateMachine,
      ...Object.values(manifest.tracks),
      ...Object.values(manifest.inputs),
      ...Object.values(manifest.nodes),
    ])
      // An abstract library id that happens to equal a clip name is not hard-coding.
      if (value && !abstract.has(value)) names.add(value);
  }
  const legacy = ['riveHair', 'riveOutfit', 'riveGlasses'];
  const offenders: string[] = [];
  for (const root of ['src', 'shared', 'server']) {
    for (const path of files(root)) {
      const file = relative('.', path).split(sep).join('/');
      if (file.startsWith('src/renderer/characters/')) continue;
      const text = readFileSync(path, 'utf8');
      for (const name of names)
        for (const quote of ["'", '"', '`'])
          if (text.includes(quote + name + quote)) offenders.push(`${file}: ${name}`);
      // Legacy palette fields may only appear in the versioned migration.
      if (file !== 'shared/protocol.ts')
        for (const name of legacy) if (text.includes(name)) offenders.push(`${file}: ${name}`);
    }
  }
  expect(names.size).toBeGreaterThan(10);
  expect(offenders).toEqual([]);
});
