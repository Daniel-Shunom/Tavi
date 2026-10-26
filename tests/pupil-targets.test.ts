import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
// @ts-expect-error -- plain authoring pipeline module.
import { addEyeTargets } from '../tools/mascot-remix/steps/eyes.mjs';

const source = readFileSync('art/mascot-remix/scene.rml', 'utf8');
describe('eye-local pupil targets', () => {
  it('authors idempotently without moving the targets back to head space', () => {
    expect(addEyeTargets(source)).toBe(source);
    expect(source).toMatch(/<Node[^>]*id="0:487"[^>]*><Shape[^>]*id="0:830"/);
    expect(source).toMatch(/<Node[^>]*id="0:517"[^>]*><Shape[^>]*id="0:836"/);
  });
  it('copies gaze displacement in local coordinates and retains the pupil clamps', () => {
    const copies = [
      ...source.matchAll(
        /<TranslationConstraint[^>]*name="(?:local pupil offset|eye-local pupil target)"[^>]*>/g,
      ),
    ];
    expect(copies).toHaveLength(3);
    for (const [tag] of copies) {
      expect(tag).toContain('sourceSpaceValue="local"');
      expect(tag).toContain('destSpaceValue="local"');
      expect(tag).toContain('offset="true"');
    }
    for (const id of ['0:1267', '0:1280'])
      expect(source).toMatch(new RegExp(`<DistanceConstraint[^>]*distance="8"[^>]*id="${id}"`));
  });
});
