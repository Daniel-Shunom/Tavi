import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { it, expect } from 'vitest';

it('walks in both directions without crossing the visible calf paths', () => {
  const result = execFileSync('python', ['tools/tavi-rive-lab/check_walk_calves.py'], {
    encoding: 'utf8',
    timeout: 15000,
  });
  expect(result).toContain('walking: 0 crossed-calf frames');
  expect(result).toContain('locomotion: 0 crossed-calf frames');
}, 20000);

it('keeps stylized high knee lifts connected to the original foot timing without stretching limbs', () => {
  const result = execFileSync('python', ['tools/tavi-rive-lab/check_motion_legs.py'], {
    encoding: 'utf8',
    timeout: 20000,
  });
  for (const mode of ['walk', 'sprint', 'skip'])
    expect(result).toContain(`${mode}: high/tucked knees; original segment reach;`);
}, 25000);

it('preserves the central skirt design instead of following individual thigh bends', () => {
  const result = execFileSync('python', ['tools/tavi-rive-lab/check_skirt_design.py'], {
    encoding: 'utf8',
    timeout: 15000,
  });
  expect(result).toContain(
    'Geometric skirt design remains consistent across ordinary poses and locomotion.',
  );
}, 20000);

it('keeps turn artwork continuous, rear faces occluded, and the skirt fitted', () => {
  const result = execFileSync('python', ['tools/tavi-rive-lab/check_turnaround.py'], {
    encoding: 'utf8',
    timeout: 15000,
  });
  expect(result).toContain('continuous crown, fitted skirt, and loop verified');
  expect(result).toContain('Climbing controls remain isolated.');
}, 20000);

it('pins climbing grips and footholds in both travel directions and preserves limb lengths', () => {
  const result = execFileSync('python', ['tools/tavi-rive-lab/check_climbing.py'], {
    encoding: 'utf8',
    timeout: 45000,
  });
  for (const view of ['front', 'left', 'right', 'rear'])
    expect(result).toContain(`${view}: hand drift <=`);
  expect(result).toContain('Climbing preserves original limb lengths in all four views.');
}, 50000);

it('keeps emitted walking contacts planted, foot targets reachable, and the loop continuous', () => {
  const result = execFileSync('python', ['tools/tavi-rive-lab/check_walk.py'], {
    encoding: 'utf8',
  });
  expect(result).toContain('right: 6 steps, 180u travel');
  expect(result).toContain('left: 6 steps, 180u travel');
  expect(result).toContain('Loop closes without a reset.');
});

it('keeps sprint and bounding-skip contacts and reach valid without changing leg lengths', () => {
  const result = execFileSync('python', ['tools/tavi-rive-lab/check_gaits.py'], {
    encoding: 'utf8',
    timeout: 15000,
  });
  expect(result).toContain('sprint: reach <=');
  expect(result).toContain('skip: reach <=');
  expect(result).toContain('Sprint hands face travel');
  expect(result).toContain('Leg lengths unchanged.');
}, 20000);

it('keeps seated perspective controls out of all locomotion and joint-review projects', () => {
  for (const project of ['walking', 'locomotion', 'interactive', 'seating-left', 'seating-right']) {
    const source = readFileSync(`art/tavi-rive-lab/${project}/scene.rml`, 'utf8');
    expect(source).not.toContain('seated/front-projection');
    expect(source).not.toContain('tavi/render-leg-');
  }
  expect(readFileSync('art/tavi-rive-lab/seating/scene.rml', 'utf8')).toContain(
    'seated/front-projection',
  );
});

it('keeps seated ankle attachments continuous and returns to standing at the same root', () => {
  const result = execFileSync('python', ['tools/tavi-rive-lab/check_seating.py'], {
    encoding: 'utf8',
    timeout: 15000,
  });
  expect(result).toContain('front: ledge contact stable');
  expect(result).toContain('left: ledge contact stable');
  expect(result).toContain('right: ledge contact stable');
}, 20000);
