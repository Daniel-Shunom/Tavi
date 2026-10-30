import { execFileSync } from 'node:child_process';
import { expect, it } from 'vitest';

it('ports complete facial endpoints without taking ownership of body or gaze', () => {
  const result = execFileSync('python', ['tools/tavi-rive-lab/check_expressions.py'], {
    encoding: 'utf8',
    timeout: 15000,
  });
  expect(result).toContain('34 canonical emotes plus neutral; 105 complete endpoints');
  expect(result).toContain('Facial ownership, exclusive mouth selection');
  expect(result).toContain('five source hashes verified');
}, 20000);
