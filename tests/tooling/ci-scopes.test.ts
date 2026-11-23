import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { planEvent, planFiles, testScopes } from '../../tools/ci/scopes';
import { planPush } from '../../tools/ci/push';

const base = '1'.repeat(40),
  head = '2'.repeat(40);
describe('affected-program selection', () => {
  it.each([
    'README.md',
    'desktop/REFERENCE.md',
    'src/renderer/characters/MANIFESTS.md',
    '.agents/skills/example/SKILL.md',
    '.session_id',
    '.sessions',
  ])('does no application work for %s', (path) => {
    expect(planFiles([path])).toEqual({
      suites: [],
      quality: false,
      webBuild: false,
      installers: false,
    });
  });

  it.each([
    'src/LandingPage.tsx',
    'src/DownloadPage.tsx',
    'src/CrtScene.tsx',
    'src/landing.css',
    'src/download.css',
    'src/landing/dither.ts',
    'public/media/tv/rain.mp4',
  ])('tests and builds only the web frontend for %s', (path) => {
    expect(planFiles([path])).toEqual({
      suites: ['web'],
      quality: true,
      webBuild: true,
      installers: false,
    });
  });

  it.each(['src/studio.tsx', 'src/studio/LookView.tsx', 'src/studio.css', 'src/YoutubePanel.tsx'])(
    'selects only Studio tests for %s',
    (path) => {
      expect(planFiles([path])).toEqual({
        suites: ['studio'],
        quality: true,
        webBuild: true,
        installers: true,
      });
    },
  );

  it('adds shared-renderer consumers without running unrelated email or CI tests', () => {
    expect(planFiles(['src/renderer/Avatar.tsx']).suites).toEqual([
      'web',
      'studio',
      'service',
      'renderer',
      'authoring',
    ]);
    expect(planFiles(['shared/protocol.ts']).suites).toEqual(
      testScopes.filter((scope) => scope !== 'tooling'),
    );
  });
  it('selects service and desktop consumers without a frontend build for server edits', () => {
    expect(planFiles(['server/youtube/integration.ts'])).toEqual({
      suites: ['service', 'desktop'],
      quality: true,
      webBuild: false,
      installers: true,
    });
  });
  it('keeps email and authoring work separate from native builds', () => {
    expect(planFiles(['supabase/functions/_shared/templates.ts']).suites).toEqual(['email']);
    expect(planFiles(['tools/tavi-rive-lab/build.py'])).toEqual({
      suites: ['authoring'],
      quality: true,
      webBuild: false,
      installers: false,
    });
  });
  it('validates every suite after test-runner changes without creating application builds', () => {
    expect(planFiles(['tools/test.mjs'])).toEqual({
      suites: [...testScopes],
      quality: true,
      webBuild: false,
      installers: false,
    });
  });
  it.each(testScopes)('runs only the owning suite for tests/%s edits', (scope) => {
    expect(planFiles([`tests/${scope}/example.test.ts`])).toEqual({
      suites: [scope],
      quality: true,
      webBuild: false,
      installers: false,
    });
  });
  it('keeps packaged credits and icon changes in native build coverage', () => {
    expect(planFiles(['public/credits/rive-avatar.md']).installers).toBe(true);
    expect(planFiles(['brand/logo/tavi-icon-1024.png']).installers).toBe(true);
    expect(planFiles(['brand/screenshots/studio.png']).installers).toBe(false);
  });
  it('runs packaging unit tests without building installers when only those tests change', () => {
    expect(planFiles(['desktop/scripts/platform.test.mjs'])).toEqual({
      suites: ['desktop'],
      quality: true,
      webBuild: false,
      installers: false,
    });
  });
  it.each(['package.json', 'package-lock.json', 'tsconfig.json', 'vite.config.ts'])(
    'runs all suites and builds for shared build input %s',
    (path) => {
      expect(planFiles([path])).toEqual({
        suites: [...testScopes],
        quality: true,
        webBuild: true,
        installers: true,
      });
    },
  );
  it('combines mixed changes without repeating suites or truncating large changesets', () => {
    const files = Array.from({ length: 400 }, (_, index) => `docs/${String(index)}.md`);
    files.push('src/LandingPage.tsx', 'src/studio.tsx', 'src/landing/dither.ts');
    expect(planFiles(files).suites).toEqual(['web', 'studio']);
    expect(planFiles(files).installers).toBe(true);
  });
  it('covers two-dot main pushes, three-dot PRs, release overrides and missing histories', () => {
    const diff = vi.fn(() => ['README.md']);
    expect(
      planEvent('push', 'refs/heads/main', { before: base, after: head }, diff).installers,
    ).toBe(false);
    expect(diff).toHaveBeenLastCalledWith(base, head, '..');
    planEvent(
      'pull_request',
      'refs/pull/15/merge',
      { pull_request: { base: { sha: base }, head: { sha: head } } },
      diff,
    );
    expect(diff).toHaveBeenLastCalledWith(base, head, '...');
    expect(planEvent('workflow_dispatch', 'refs/heads/main', {}, diff).suites).toEqual(testScopes);
    expect(planEvent('push', 'refs/tags/v0.2.0', {}, diff).installers).toBe(true);
    expect(
      planEvent('push', 'refs/heads/main', { before: '0'.repeat(40), after: head }, diff)
        .installers,
    ).toBe(true);
    expect(planEvent('pull_request', '', { pull_request: {} }, diff).installers).toBe(true);
    expect(
      planEvent('push', '', { before: base, after: head }, () => {
        throw new Error('Missing commit');
      }).suites,
    ).toEqual(testScopes);
  });
  it('assigns every test file to exactly one named program', () => {
    const paths = readdirSync('tests', { recursive: true, encoding: 'utf8' }).filter((path) =>
      path.endsWith('.test.ts'),
    );
    const unowned = paths.filter(
      (path) => !testScopes.some((scope) => path.replaceAll('\\', '/').startsWith(scope + '/')),
    );
    expect(unowned).toEqual([]);
    for (const scope of testScopes)
      expect(paths.some((path) => path.replaceAll('\\', '/').startsWith(scope + '/'))).toBe(true);
  });
});

describe('scoped local pre-push checks', () => {
  it('checks only changes since the remote branch tip', () => {
    const diff = vi.fn(() => ['src/LandingPage.tsx']);
    expect(
      planPush(`refs/heads/feature ${head} refs/heads/feature ${base}\n`, diff, () => base).suites,
    ).toEqual(['web']);
    expect(diff).toHaveBeenCalledWith(base, head, '..');
  });
  it('uses main as the comparison for a new branch', () => {
    const mergeBase = vi.fn(() => base);
    expect(
      planPush(
        `refs/heads/feature ${head} refs/heads/feature ${'0'.repeat(40)}\n`,
        () => ['docs/PLAN.md'],
        mergeBase,
      ).quality,
    ).toBe(false);
    expect(mergeBase).toHaveBeenCalledWith(head);
  });
  it('validates everything for a version tag or missing comparison', () => {
    expect(
      planPush(
        `refs/tags/v1.0.0 ${head} refs/tags/v1.0.0 ${base}`,
        () => [],
        () => base,
      ).suites,
    ).toEqual(testScopes);
    expect(
      planPush(
        '',
        () => [],
        () => base,
      ).suites,
    ).toEqual(testScopes);
  });
  it('does not rebuild or retest deleted remote branches', () => {
    expect(
      planPush(
        `(delete) ${'0'.repeat(40)} refs/heads/feature ${base}`,
        () => [],
        () => base,
      ).suites,
    ).toEqual([]);
  });
});

describe('real git event selection', () => {
  const directory = mkdtempSync(join(tmpdir(), 'tavi-ci-selection-'));
  const script = fileURLToPath(new URL('../../tools/ci/plan.ts', import.meta.url));
  const git = (...args: string[]) =>
    execFileSync('git', args, { cwd: directory, encoding: 'utf8' }).trim();
  const commit = () => {
    git('add', '--all');
    git(
      '-c',
      'user.name=Tavi CI',
      '-c',
      'user.email=ci@example.invalid',
      '-c',
      'commit.gpgsign=false',
      'commit',
      '-qm',
      'test change',
    );
    return git('rev-parse', 'HEAD');
  };
  git('init', '-q', '--initial-branch=main');
  mkdirSync(join(directory, 'src/studio'), { recursive: true });
  writeFileSync(join(directory, 'src/studio/Panel.tsx'), 'export const value = 1;');
  const initial = commit();
  git('checkout', '-qb', 'feature');
  mkdirSync(join(directory, 'src/landing'), { recursive: true });
  writeFileSync(join(directory, 'src/landing/feature.ts'), 'export const web = true;');
  const feature = commit();
  git('checkout', '-q', 'main');
  writeFileSync(join(directory, 'src/studio/Panel.tsx'), 'export const value = 2;');
  const main = commit();

  afterAll(() => {
    if (
      dirname(resolve(directory)) === resolve(tmpdir()) &&
      basename(directory).startsWith('tavi-ci-selection-')
    )
      rmSync(directory, { recursive: true, force: true });
  });
  function run(eventName: string, event: unknown) {
    // Event/output files live outside the fixture repo so subsequent diffs stay meaningful.
    const eventFile = directory + '.event.json';
    const output = directory + '.output.txt';
    writeFileSync(eventFile, JSON.stringify(event));
    writeFileSync(output, '');
    try {
      execFileSync(process.execPath, ['--experimental-strip-types', script], {
        cwd: directory,
        env: {
          ...process.env,
          GITHUB_EVENT_NAME: eventName,
          GITHUB_REF: 'refs/heads/main',
          GITHUB_EVENT_PATH: eventFile,
          GITHUB_OUTPUT: output,
          GITHUB_STEP_SUMMARY: '',
        },
      });
      return Object.fromEntries(
        readFileSync(output, 'utf8')
          .trim()
          .split('\n')
          .map((line) => {
            const index = line.indexOf('=');
            return [line.slice(0, index), JSON.parse(line.slice(index + 1)) as unknown];
          }),
      );
    } finally {
      rmSync(eventFile);
      rmSync(output);
    }
  }
  it('ignores unrelated main commits when selecting a PR from its merge base', () => {
    const result = run('pull_request', {
      pull_request: { base: { sha: main }, head: { sha: feature } },
    });
    expect(result['suites']).toEqual(['web']);
    expect(result['installers']).toBe(false);
  });
  it('includes changes across the whole main push range', () => {
    expect(run('push', { before: initial, after: main })['suites']).toEqual(['studio']);
  });
});
