import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { planEvent, testScopes, type CheckPlan, type DiffFiles } from './scopes.ts';

export function planPush(
  input: string,
  diff: DiffFiles,
  mergeBase: (head: string) => string,
): CheckPlan {
  const full = () => planEvent('', '', {}, diff);
  if (!input.trim()) return full();
  const plans: CheckPlan[] = [];
  for (const line of input.trim().split('\n')) {
    const parts = line.trim().split(/\s+/);
    if (parts.length !== 4) return full();
    const [ref, head, , remote] = parts;
    if (head && /^0{40}$/.test(head)) continue; // Deleting a remote ref has no source to test.
    try {
      const base = remote && /^0{40}$/.test(remote) && head ? mergeBase(head) : remote;
      plans.push(
        planEvent(
          'push',
          ref ?? '',
          { ...(base ? { before: base } : {}), ...(head ? { after: head } : {}) },
          diff,
        ),
      );
    } catch {
      return full();
    }
  }
  return {
    suites: testScopes.filter((scope) => plans.some((plan) => plan.suites.includes(scope))),
    quality: plans.some((plan) => plan.quality),
    webBuild: plans.some((plan) => plan.webBuild),
    installers: plans.some((plan) => plan.installers),
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const git = (...args: string[]) => execFileSync('git', args, { encoding: 'utf8' }).trim();
  const plan = planPush(
    readFileSync(0, 'utf8'),
    (base, head, range) =>
      execFileSync(
        'git',
        ['diff', '--name-only', '--no-renames', '-z', `${base}${range}${head}`, '--'],
        { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 },
      )
        .split('\0')
        .filter(Boolean),
    (head) => git('merge-base', 'origin/main', head),
  );
  console.log(`Pre-push test suites: ${plan.suites.join(', ') || 'none (documentation only)'}`);
  function run(command: string, args: string[]) {
    const result = spawnSync(command, args, { stdio: 'inherit' });
    if (result.error) throw result.error;
    if (result.status !== 0) process.exit(result.status ?? 1);
  }
  // Formatting and the clean-tree check have already run in .githooks/pre-push.
  if (plan.quality) {
    run(process.execPath, ['node_modules/eslint/bin/eslint.js', '.']);
    run(process.execPath, ['node_modules/typescript/bin/tsc', '--noEmit']);
  }
  if (plan.suites.length)
    run(process.execPath, [
      '--experimental-strip-types',
      'tools/test.mjs',
      ...plan.suites.flatMap((scope) => ['--scope', scope]),
    ]);
  run('python', ['tools/skills.py']);
}
