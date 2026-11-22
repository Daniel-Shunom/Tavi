import { execFileSync } from 'node:child_process';
import { appendFileSync, readFileSync } from 'node:fs';
import { planEvent, type ChangeEvent } from './scopes.ts';

const event = JSON.parse(
  readFileSync(process.env['GITHUB_EVENT_PATH'] ?? '', 'utf8'),
) as ChangeEvent;
const plan = planEvent(
  process.env['GITHUB_EVENT_NAME'] ?? '',
  process.env['GITHUB_REF'] ?? '',
  event,
  (base, head, range) =>
    execFileSync(
      'git',
      ['diff', '--name-only', '--no-renames', '-z', `${base}${range}${head}`, '--'],
      {
        encoding: 'utf8',
        maxBuffer: 16 * 1024 * 1024,
      },
    )
      .split('\0')
      .filter(Boolean),
);
console.log(JSON.stringify(plan));
if (process.env['GITHUB_OUTPUT'])
  appendFileSync(
    process.env['GITHUB_OUTPUT'],
    Object.entries(plan)
      .filter(([key]) => key !== 'reason')
      .map(([key, value]) => `${key}=${JSON.stringify(value)}\n`)
      .join(''),
  );
if (process.env['GITHUB_STEP_SUMMARY'])
  appendFileSync(
    process.env['GITHUB_STEP_SUMMARY'],
    `Tests: **${plan.suites.join(', ') || 'none (documentation only)'}**\n\nWeb build: **${plan.webBuild}** · Installers: **${plan.installers}**\n\n${plan.reason}\n`,
  );
