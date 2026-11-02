// Each installer carries the runner's native Node binary. Universal/cross builds would mix
// architectures, so use one native runner for each supported platform/architecture pair.
// `updater` names the bundle the in-app updater installs from and its key in latest.json
// (Tauri's {os}-{arch} platform ids). Linux updates through the AppImage; .deb installs update
// through the system package manager instead.
export function desktopPlatform(platform = process.platform, arch = process.arch) {
  const targets = {
    'win32-x64': {
      target: 'x86_64-pc-windows-msvc',
      node: 'node.exe',
      bundles: ['nsis'],
      updater: { key: 'windows-x86_64', bundle: 'nsis', suffix: '-setup.exe' },
    },
    'linux-x64': {
      target: 'x86_64-unknown-linux-gnu',
      node: 'node',
      bundles: ['deb', 'appimage'],
      updater: { key: 'linux-x86_64', bundle: 'appimage', suffix: '.AppImage' },
    },
    'darwin-x64': {
      target: 'x86_64-apple-darwin',
      node: 'node',
      bundles: ['dmg'],
      updater: { key: 'darwin-x86_64', bundle: 'macos', suffix: '.app.tar.gz' },
    },
    'darwin-arm64': {
      target: 'aarch64-apple-darwin',
      node: 'node',
      bundles: ['dmg'],
      updater: { key: 'darwin-aarch64', bundle: 'macos', suffix: '.app.tar.gz' },
    },
  };
  const result = targets[`${platform}-${arch}`];
  if (!result) throw new Error(`Unsupported desktop build host: ${platform}-${arch}`);
  return result;
}
