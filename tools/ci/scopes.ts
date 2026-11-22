export const testScopes = [
  'web',
  'studio',
  'service',
  'renderer',
  'shared',
  'desktop',
  'email',
  'authoring',
  'tooling',
] as const;
export type TestScope = (typeof testScopes)[number];

const marketingFiles = new Set([
  'src/LandingPage.tsx',
  'src/DownloadPage.tsx',
  'src/CrtScene.tsx',
  'src/landing.css',
  'src/download.css',
  'public/robots.txt',
  'public/sitemap.xml',
]);
const commonInputs = new Set([
  'package.json',
  'package-lock.json',
  '.npmrc',
  '.nvmrc',
  '.node-version',
  'vite.config.ts',
  'vite.config.js',
  'index.html',
]);
const runtimeScopes = testScopes.filter((scope) => scope !== 'tooling');

export interface CheckPlan {
  suites: TestScope[];
  quality: boolean;
  webBuild: boolean;
  installers: boolean;
}

/** The program owning a change, plus consumers of shared runtime contracts. */
export function planFiles(files: readonly string[]): CheckPlan {
  const selected = new Set<TestScope>();
  let quality = false,
    webBuild = false,
    installers = false;
  const tests = (...scopes: readonly TestScope[]) => {
    quality = true;
    for (const scope of scopes) selected.add(scope);
  };
  for (const input of files) {
    const path = input.replaceAll('\\', '/').replace(/^\.\//, '');
    if (path.startsWith('public/credits/')) {
      installers = true;
      continue;
    }
    if (/\.(?:md|mdx|rst)$/i.test(path)) continue;
    if (commonInputs.has(path) || /^tsconfig(?:\.[^/]+)?\.json$/.test(path)) {
      tests(...testScopes);
      webBuild = true;
      installers = true;
    } else if (path.startsWith('tests/')) {
      const scope = path.split('/')[1];
      if (testScopes.some((candidate) => candidate === scope)) tests(scope as TestScope);
      else if (path.startsWith('tests/fixtures/')) tests('renderer', 'service');
      else if (path.startsWith('tests/helpers/')) tests('renderer');
      else tests(...testScopes);
    } else if (
      path.startsWith('tools/ci/') ||
      path.startsWith('.github/workflows/') ||
      path.startsWith('.githooks/')
    ) {
      tests('tooling');
      if (path === '.github/workflows/desktop-installers.yml') installers = true;
    } else if (path === 'vitest.config.ts' || path === 'tools/test.mjs') {
      tests(...testScopes);
    } else if (
      path.startsWith('src/landing/') ||
      marketingFiles.has(path) ||
      path.startsWith('public/media/') ||
      path.startsWith('public/models/television-01/')
    ) {
      tests('web');
      webBuild = true;
    } else if (path.startsWith('shared/')) {
      tests(...runtimeScopes);
      webBuild = true;
      installers = true;
    } else if (path.startsWith('src/renderer/')) {
      tests('renderer', 'web', 'studio', 'service', 'authoring');
      webBuild = true;
      installers = true;
    } else if (path.startsWith('src/avatar-lab/')) {
      tests('renderer');
      webBuild = true;
      installers = true;
    } else if (path.startsWith('src/')) {
      tests('studio');
      webBuild = true;
      installers = true;
      if (path === 'src/main.tsx' || path === 'src/style.css' || path === 'src/analytics.ts')
        tests('web');
    } else if (path.startsWith('desktop/') && /\.test\.mjs$/.test(path)) {
      tests('desktop');
    } else if (path.startsWith('desktop/')) {
      tests('desktop');
      installers = true;
    } else if (
      path === 'server/mailing-pages.ts' ||
      path === 'api/mailing.ts' ||
      path.startsWith('supabase/') ||
      path.startsWith('tools/email') ||
      path === 'tools/release-email.ts'
    ) {
      tests('email');
      if (path.startsWith('server/')) {
        tests('service', 'desktop');
        installers = true;
      }
    } else if (path.startsWith('server/')) {
      tests('service', 'desktop');
      installers = true;
    } else if (path.startsWith('api/') || path === 'vercel.json' || path === 'Dockerfile.judging') {
      tests('service');
    } else if (path.startsWith('assets/')) {
      tests('renderer', 'studio', 'shared');
      webBuild = true;
      installers = true;
    } else if (path === 'brand/logo/tavi-icon-1024.png') {
      tests('desktop');
      installers = true;
    } else if (path.startsWith('public/')) {
      tests('web', 'studio', 'renderer');
      webBuild = true;
      installers = true;
    } else if (
      path.startsWith('art/') ||
      path.startsWith('tools/tavi-rive-lab/') ||
      path.startsWith('tools/mascot-remix/')
    ) {
      tests('authoring');
    } else if (path === 'eslint.config.mjs' || path.startsWith('.prettier')) {
      tests('tooling');
    } else if (
      path === 'tools/prerender-landing.mjs' ||
      path === 'tools/precompress.mjs' ||
      path === 'tools/build-judging.mjs'
    ) {
      tests('web');
      webBuild = true;
    } else if (path.startsWith('tools/')) {
      tests('tooling');
    }
  }
  return {
    suites: testScopes.filter((scope) => selected.has(scope)),
    quality,
    webBuild,
    installers,
  };
}

export interface ChangeEvent {
  before?: string;
  after?: string;
  pull_request?: { base?: { sha?: string }; head?: { sha?: string } };
}
export type DiffFiles = (base: string, head: string, range: '..' | '...') => readonly string[];

export function planEvent(
  eventName: string,
  ref: string,
  event: ChangeEvent,
  diff: DiffFiles,
): CheckPlan & { reason: string } {
  const full = (reason: string) => ({
    suites: [...testScopes],
    quality: true,
    webBuild: true,
    installers: true,
    reason,
  });
  if (eventName === 'workflow_dispatch' || (eventName === 'push' && ref.startsWith('refs/tags/v')))
    return full('Manual build or version tag.');
  const base = eventName === 'pull_request' ? event.pull_request?.base?.sha : event.before;
  const head = eventName === 'pull_request' ? event.pull_request?.head?.sha : event.after;
  const validSha = (value: string | undefined): value is string =>
    typeof value === 'string' && /^[0-9a-f]{40}$/i.test(value) && !/^0+$/.test(value);
  if (!['push', 'pull_request'].includes(eventName) || !validSha(base) || !validSha(head))
    return full('No reliable comparison; validate everything.');
  try {
    return {
      ...planFiles(diff(base, head, eventName === 'pull_request' ? '...' : '..')),
      reason: 'Selected from changed files and shared consumers.',
    };
  } catch {
    return full('Comparison failed; validate everything.');
  }
}
