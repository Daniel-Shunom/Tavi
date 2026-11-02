import { test } from 'node:test';
import assert from 'node:assert/strict';
import { desktopPlatform } from './platform.mjs';
import { fragment, merge, publishedName, releaseUrl } from './updater-manifest.mjs';

test('every native build has a distinct Tauri updater platform', () => {
  const keys = [
    ['win32', 'x64'],
    ['linux', 'x64'],
    ['darwin', 'x64'],
    ['darwin', 'arm64'],
  ].map(([os, arch]) => desktopPlatform(os, arch).updater.key);
  assert.deepEqual(keys, ['windows-x86_64', 'linux-x86_64', 'darwin-x86_64', 'darwin-aarch64']);
});

test('URLs point at the published (dotted) asset name on the version tag', () => {
  assert.equal(publishedName('Tavi Studio_0.1.1_x64-setup.exe'), 'Tavi.Studio_0.1.1_x64-setup.exe');
  assert.equal(
    releaseUrl('0.1.1', 'Tavi Studio_0.1.1_x64-setup.exe'),
    'https://github.com/Daniel-Shunom/Tavi/releases/download/v0.1.1/Tavi.Studio_0.1.1_x64-setup.exe',
  );
});

test('merges one fragment per platform into latest.json', () => {
  const parts = ['windows-x86_64', 'linux-x86_64', 'darwin-x86_64', 'darwin-aarch64'].map((key) =>
    fragment({
      version: '0.1.1',
      key,
      name: `Tavi Studio_0.1.1_${key}.bin`,
      signature: `sig-${key}\n`,
    }),
  );
  const manifest = merge(parts, { notes: 'n', pubDate: '2026-11-02T00:00:00.000Z' });
  assert.equal(manifest.version, '0.1.1');
  assert.equal(manifest.pub_date, '2026-11-02T00:00:00.000Z');
  assert.equal(Object.keys(manifest.platforms).length, 4);
  assert.equal(manifest.platforms['windows-x86_64'].signature, 'sig-windows-x86_64');
});

test('refuses empty signatures, mixed versions and duplicate platforms', () => {
  assert.throws(() => fragment({ version: '1', key: 'k', name: 'n', signature: ' ' }), /Empty/);
  const a = fragment({ version: '1', key: 'k', name: 'n', signature: 's' });
  const b = fragment({ version: '2', key: 'j', name: 'n', signature: 's' });
  assert.throws(() => merge([a, b]), /disagree/);
  assert.throws(() => merge([a, a]), /Duplicate/);
  assert.throws(() => merge([]), /No updater fragments/);
});
