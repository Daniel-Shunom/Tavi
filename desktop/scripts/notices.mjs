// Builds THIRD-PARTY-NOTICES.txt for everything the installer redistributes: the Node runtime,
// npm packages bundled into the frontend or installed for the service, the Rust crates linked
// into the shell, and the third-party character artwork.
import { readFile, readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const licenseFile = /^(licen[cs]e|copying|notice)([-._].*)?$/i;

async function licenseTexts(directory) {
  let entries = [];
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch {
    return [];
  }
  const files = entries
    .filter((entry) => entry.isFile() && licenseFile.test(entry.name))
    .map((entry) => entry.name)
    .sort();
  return Promise.all(
    files.map(async (name) => ({ name, text: (await readFile(join(directory, name), 'utf8')).trim() })),
  );
}

/** Standard MIT text for packages that declare MIT but ship no license file. */
function mitText(author) {
  return `No license file shipped with the package; it declares the MIT License:

Copyright (c) ${author ?? 'the package authors'}

Permission is hereby granted, free of charge, to any person obtaining a copy of this software
and associated documentation files (the "Software"), to deal in the Software without
restriction, including without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the
Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or
substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING
BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.`;
}

function section(title, license, texts, fallback) {
  const body = texts.length
    ? texts.map(({ name, text }) => `--- ${name} ---\n${text}`).join('\n\n')
    : fallback;
  return `${'='.repeat(78)}\n${title}\nLicense: ${license || 'see package'}\n\n${body}\n`;
}

/** Production npm packages under `cwd` (excluding the root project itself). */
function npmPackageDirs(cwd) {
  const npmCli = process.env.npm_execpath;
  const result = spawnSync(
    process.execPath,
    [npmCli, 'ls', '--omit=dev', '--all', '--parseable'],
    { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
  );
  if (result.status !== 0 && !result.stdout) throw new Error(`npm ls failed in ${cwd}`);
  return result.stdout.split(/\r?\n/).filter(Boolean).slice(1);
}

async function npmSections(directories) {
  const seen = new Map();
  for (const directory of directories) {
    let manifest;
    try {
      manifest = JSON.parse(await readFile(join(directory, 'package.json'), 'utf8'));
    } catch {
      continue;
    }
    const key = `${manifest.name}@${manifest.version}`;
    if (seen.has(key)) continue;
    const license =
      typeof manifest.license === 'string' ? manifest.license : manifest.license?.type;
    seen.set(
      key,
      section(
        `npm: ${key}`,
        license,
        await licenseTexts(directory),
        license === 'MIT'
          ? mitText(typeof manifest.author === 'string' ? manifest.author : manifest.author?.name)
          : `No license file shipped with the package. Declared license: ${license ?? 'unknown'}.`,
      ),
    );
  }
  return [...seen.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, text]) => text);
}

async function crateSections(manifestDir) {
  const result = spawnSync(
    'cargo',
    ['metadata', '--format-version', '1', '--locked', '--filter-platform', 'x86_64-pc-windows-msvc'],
    { cwd: manifestDir, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 },
  );
  if (result.status !== 0) throw new Error(`cargo metadata failed: ${result.stderr}`);
  const metadata = JSON.parse(result.stdout);
  const packages = new Map(metadata.packages.map((pkg) => [pkg.id, pkg]));
  const nodes = new Map(metadata.resolve.nodes.map((node) => [node.id, node]));
  // Walk normal (runtime) dependencies only: build tools and proc-macros are not shipped.
  const linked = new Set();
  const queue = [metadata.resolve.root];
  while (queue.length) {
    const id = queue.pop();
    for (const dep of nodes.get(id)?.deps ?? []) {
      const runtime = dep.dep_kinds.some((kind) => kind.kind === null);
      const target = packages.get(dep.pkg);
      const procMacro = target?.targets.some((t) => t.kind.includes('proc-macro'));
      if (runtime && !procMacro && !linked.has(dep.pkg)) {
        linked.add(dep.pkg);
        queue.push(dep.pkg);
      }
    }
  }
  const sections = [];
  for (const id of linked) {
    const pkg = packages.get(id);
    sections.push(
      section(
        `Rust crate: ${pkg.name}@${pkg.version}`,
        pkg.license,
        await licenseTexts(dirname(pkg.manifest_path)),
        `No license file shipped with the crate. Declared license: ${pkg.license ?? 'unknown'}.`,
      ),
    );
  }
  return sections.sort();
}

/** Include nested asset credits in deterministic path order. */
export async function artworkCredits(directory) {
  const entries = (await readdir(directory, { withFileTypes: true })).sort((a, b) =>
    a.name.localeCompare(b.name),
  );
  const texts = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) texts.push(...(await artworkCredits(path)));
    else if (entry.isFile()) texts.push((await readFile(path, 'utf8')).trim());
  }
  return texts;
}

export async function collectNotices({ root, service, nodeLicense, nodeVersion, version }) {
  const desktop = fileURLToPath(new URL('../', import.meta.url));
  const credits = join(root, 'public', 'credits');
  const artwork = await artworkCredits(credits);
  const npm = await npmSections([...npmPackageDirs(root), ...npmPackageDirs(service)]);
  const crates = await crateSections(join(desktop, 'src-tauri'));
  return [
    `Tavi Studio ${version} - third-party notices`,
    '',
    'Tavi Studio redistributes the third-party components listed below. Each is provided under',
    'its own license, reproduced here. Microsoft Edge WebView2 is provided by Windows and is not',
    'redistributed by this installer.',
    '',
    section('Character artwork', 'CC BY 4.0', [{ name: 'credits', text: artwork.join('\n\n') }]),
    section(`Node.js runtime ${nodeVersion}`, 'MIT and bundled licenses', [
      { name: 'LICENSE', text: (await readFile(nodeLicense, 'utf8')).trim() },
    ]),
    ...npm,
    ...crates,
  ].join('\n');
}
