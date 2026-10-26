import { expect, it } from 'vitest';
import { beat, type ExpressionScript } from '../shared/cue';
import type { ExpressionId } from '../shared/expressions';
import { composePose, phaseLookup } from '../src/renderer/compose';
import { characters } from '../src/renderer/characters/registry';
import { sampleScript } from '../src/renderer/timeline';

it('never holds any expression perfectly still (without reduced motion)', () => {
  const still: string[] = [];
  for (const manifest of characters.values()) {
    for (const id of Object.keys(manifest.expressions) as ExpressionId[]) {
      for (const intensity of [0.2, 0.6, 0.9]) {
        const script: ExpressionScript = {
          id: 'cue',
          sourceEventId: 'event',
          source: 'manual',
          decidedBy: { kind: 'manual', label: 'Studio' },
          priority: 3,
          startAt: 0,
          expiresAt: 3000,
          beats: [beat(id, { hold: 4, intensity, target: 'chat' })],
          settle: true,
          dropped: [],
        };
        const lookup = phaseLookup(manifest);
        const poses = [1500, 2100, 2700, 3300].map((time) => {
          const layers = sampleScript(script, time, lookup);
          expect(layers[0]?.phase, `${id} at ${String(time)}`).toBe('hold');
          return JSON.stringify(composePose(layers, manifest, { side: () => 1 }));
        });
        if (new Set(poses).size < poses.length)
          still.push(`${manifest.id}:${id}@${String(intensity)}`);
      }
    }
  }
  expect(still).toEqual([]);
});

it('lets a manifest hand an expression to a motion performance', () => {
  const manifest = characters.get('mascot');
  if (!manifest) throw new Error('missing mascot');
  const layers = sampleScript(
    {
      id: 'cue',
      sourceEventId: 'event',
      source: 'manual',
      decidedBy: { kind: 'manual', label: 'Studio' },
      priority: 3,
      startAt: 0,
      expiresAt: 3000,
      beats: [beat('agreeing', { hold: 3, caption: 'Fair.' })],
      settle: true,
      dropped: [],
    },
    1000,
    phaseLookup(manifest),
  );
  const own = composePose(layers, manifest);
  expect(own.tracks.length).toBeGreaterThan(0);
  expect(own.performances.map((entry) => entry.id)).toEqual(['nod']);
  const handed = composePose(layers, manifest, { delegated: new Set(['nod']) });
  expect(handed.tracks).toEqual([]);
  expect(handed.offset).toEqual({ x: 0, y: 0, rotation: 0, scale: 1 });
  expect(handed.caption).toBe('Fair.');
});
