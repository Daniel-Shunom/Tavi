import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { artworkCredits } from './notices.mjs';

test('collects nested asset attribution without reading directories as files', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'tavi-credits-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, 'avatar-lab'));
  await mkdir(join(root, 'empty'));
  await writeFile(join(root, 'avatar-lab', 'README.md'), '  Nested asset license\n');
  await writeFile(join(root, 'rive-avatar.md'), 'Main character license\n');
  assert.deepEqual(await artworkCredits(root), ['Nested asset license', 'Main character license']);
});
