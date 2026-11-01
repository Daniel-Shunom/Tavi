// Each installer carries the runner's native Node binary. Universal/cross builds would mix
// architectures, so use one native runner for each supported platform/architecture pair.
export function desktopPlatform(platform = process.platform, arch = process.arch) {
  const targets = {
    'win32-x64': { target: 'x86_64-pc-windows-msvc', node: 'node.exe', bundles: ['nsis'] },
    'linux-x64': { target: 'x86_64-unknown-linux-gnu', node: 'node', bundles: ['deb', 'appimage'] },
    'darwin-x64': { target: 'x86_64-apple-darwin', node: 'node', bundles: ['dmg'] },
    'darwin-arm64': { target: 'aarch64-apple-darwin', node: 'node', bundles: ['dmg'] },
  };
  const result = targets[`${platform}-${arch}`];
  if (!result) throw new Error(`Unsupported desktop build host: ${platform}-${arch}`);
  return result;
}
