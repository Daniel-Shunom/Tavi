import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import {
  performableExpressions,
  resolveBeats,
  resolveExpression,
  supportedSequences,
} from '../shared/capabilities';
import { beat } from '../shared/cue';
import { decisionJsonSchema, decisionSchema } from '../shared/decision';
import { capabilitiesOf, manifestSchema } from '../src/renderer/characters/manifest';
import { motionRigs } from '../src/renderer/characters/motionRigs';
import { catalog, characters, getCharacter } from '../src/renderer/characters/registry';
import { testCharacter } from './fixtures/test-character';

describe('character manifests', () => {
  it('registers a valid default character with generic appearance slots', () => {
    const mascot = getCharacter('mascot');
    expect(Object.keys(mascot.appearance)).toEqual(['hair', 'outfit', 'glasses']);
    expect(getCharacter('unknown-character').id).toBe('mascot');
    expect(catalog['mascot']?.expressions.length).toBeGreaterThan(20);
  });
  it('binds only animations that really exist in the shipped artwork', () => {
    for (const manifest of characters.values()) {
      const output = execFileSync(
        process.execPath,
        [
          'tools/rive-inventory.mjs',
          `src/renderer/characters/${manifest.id}/${manifest.asset}`,
          '--json',
        ],
        { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
      );
      const report = JSON.parse(output.slice(output.indexOf('{'))) as {
        artboards: {
          name: string;
          animations: { name: string }[];
          stateMachines: { name: string }[];
        }[];
      };
      const board = report.artboards.find((entry) => entry.name === manifest.artboard);
      expect(board, manifest.artboard).toBeDefined();
      const clips = new Set(board?.animations.map((clip) => clip.name));
      // Control tracks the motion rig patch adds in memory (src/renderer/motion/rive/patch.ts).
      for (const control of motionRigs[manifest.id]?.patch.controls ?? []) clips.add(control.name);
      for (const [handle, clip] of Object.entries(manifest.tracks))
        expect(clips.has(clip), handle).toBe(true);
      if (manifest.stateMachine)
        expect(board?.stateMachines.map((machine) => machine.name)).toContain(
          manifest.stateMachine,
        );
    }
  }, 30000);
  it('rejects bindings to unknown tracks and bad fallbacks', () => {
    const broken = structuredClone(testCharacter);
    broken.expressions = { content: { tracks: [{ track: 'missing', at: 0, mix: 1 }] } };
    expect(manifestSchema.safeParse(broken).success).toBe(false);
    const fallback = structuredClone(testCharacter);
    fallback.fallbacks = { celebrate: 'proud' };
    expect(manifestSchema.safeParse(fallback).success).toBe(false);
  });
  it('accepts a second, differently rigged character with no code changes', () => {
    const manifest = manifestSchema.parse(testCharacter);
    const capabilities = capabilitiesOf(manifest);
    expect(capabilities.expressions).toEqual(['content', 'wave', 'listening']);
    expect(capabilities.targets).toEqual(['streamer', 'neutral']);
    expect(capabilities.locomotion).toBe('clip');
    expect(capabilities.appearance['skin']?.options.map((option) => option.id)).toEqual([
      'silver',
      'gold',
    ]);
  });
});

describe('capability negotiation', () => {
  const bot = capabilitiesOf(manifestSchema.parse(testCharacter));
  it('uses declared fallbacks, then similar expressions, else drops with a reason', () => {
    expect(resolveExpression('wave', bot)).toEqual({ id: 'wave' });
    expect(resolveExpression('celebrate', bot)).toEqual({ id: 'wave', via: 'fallback' });
    expect(resolveExpression('amused', bot)).toEqual({ id: 'content', via: 'similar' });
    const sassy = resolveExpression('sassy', bot);
    expect(sassy.id).toBeNull();
    const resolution = resolveBeats(
      [beat('celebrate'), beat('sassy'), beat('glance', { target: 'chat' })],
      bot,
    );
    expect(resolution.beats.map((value) => value.expression)).toEqual(['wave', 'listening']);
    expect(resolution.beats[1]?.target).toBe('neutral');
    expect(resolution.dropped.map((value) => value.expression)).toEqual(['sassy']);
    expect(resolution.substituted).toEqual([
      { from: 'celebrate', to: 'wave' },
      { from: 'glance', to: 'listening' },
    ]);
  });
  it('tells the AI only what the active character can do', () => {
    expect(performableExpressions(bot)).toEqual(['content', 'wave', 'listening']);
    expect(supportedSequences(bot)).toEqual([]);
    const schema = decisionJsonSchema(bot);
    expect(schema.properties.beats.items.properties.expression.enum).toEqual([
      'content',
      'wave',
      'listening',
    ]);
    const validate = decisionSchema(bot);
    expect(
      validate.safeParse({
        react: true,
        reason: '',
        sequence: null,
        caption: '',
        target: 'streamer',
        beats: [
          {
            expression: 'celebrate',
            intensity: 1,
            target: 'streamer',
            caption: '',
            offset: 0,
            hold: 1,
          },
        ],
        move: null,
      }).success,
    ).toBe(false);
    const ok = validate.parse({
      react: true,
      reason: 'hi',
      sequence: null,
      caption: '',
      target: 'streamer',
      beats: [
        {
          expression: 'wave',
          intensity: 7,
          target: 'nowhere',
          caption: '  hey   you ',
          offset: -3,
          hold: 99,
        },
      ],
      move: null,
    });
    expect(ok.beats[0]).toEqual({
      expression: 'wave',
      intensity: 1,
      target: 'neutral',
      caption: 'hey you',
      offset: 0,
      hold: 6,
    });
  });
});
