import { test } from 'node:test';
import assert from 'node:assert/strict';
import { desktopPlatform } from './platform.mjs';
for (const [os, arch, target, runtime] of [
  ['win32', 'x64', 'x86_64-pc-windows-msvc', 'node.exe'],
  ['linux', 'x64', 'x86_64-unknown-linux-gnu', 'node'],
  ['darwin', 'x64', 'x86_64-apple-darwin', 'node'],
  ['darwin', 'arm64', 'aarch64-apple-darwin', 'node'],
])
  test(`matches the native runtime and Rust target for ${os}-${arch}`, () => {
    assert.equal(desktopPlatform(os, arch).target, target);
    assert.equal(desktopPlatform(os, arch).node, runtime);
  });
test('rejects architectures with no native installer job', () => {
  assert.throws(() => desktopPlatform('linux', 'arm64'), /Unsupported desktop build host/);
  assert.throws(() => desktopPlatform('win32', 'ia32'), /Unsupported desktop build host/);
});
