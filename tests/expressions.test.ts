import { describe, expect, it } from 'vitest';
import {
  canLayer,
  channels,
  expressionIds,
  expressions,
  isExpressionId,
  selectableExpressionIds,
  sequenceIds,
  sequences,
} from '../shared/expressions';
import { beat, expandSequence, scriptDuration } from '../shared/cue';

describe('expression library', () => {
  it('covers the agreed emotional and social range with abstract ids', () => {
    for (const id of [
      'amused',
      'smug',
      'skeptical',
      'impressed',
      'sympathetic',
      'embarrassed',
      'thinking',
      'bored',
      'excited',
      'teasing',
      'proud',
      'startled',
      'listening',
      'agreeing',
      'disagreeing',
    ])
      expect(isExpressionId(id), id).toBe(true);
  });
  it('describes every expression completely and consistently', () => {
    for (const id of expressionIds) {
      const definition = expressions[id];
      expect(channels).toContain(definition.channel);
      expect(definition.meaning.length, id).toBeGreaterThan(10);
      expect(definition.useWhen.length, id).toBeGreaterThan(10);
      expect(definition.avoidWhen.length, id).toBeGreaterThan(10);
      expect(definition.intensity.min).toBeLessThanOrEqual(definition.intensity.default);
      expect(definition.intensity.default).toBeLessThanOrEqual(definition.intensity.max);
      expect(definition.duration).toBeGreaterThan(0);
      expect(definition.layersWith).not.toContain(definition.channel);
      for (const similar of definition.similar) {
        expect(isExpressionId(similar), `${id} -> ${similar}`).toBe(true);
        expect(similar).not.toBe(id);
      }
    }
  });
  it('never lets the AI pick idle life', () => {
    for (const id of selectableExpressionIds) expect(expressions[id].channel).not.toBe('idle');
  });
  it('layers across channels but never within one', () => {
    expect(canLayer('skeptical', 'agreeing')).toBe(true);
    expect(canLayer('wave', 'listening')).toBe(true);
    expect(canLayer('wave', 'celebrate')).toBe(false);
  });
  it('builds sequences from valid, ordered beats', () => {
    for (const id of sequenceIds) {
      const beats = expandSequence(id);
      expect(beats.length).toBe(sequences[id].steps.length);
      expect(scriptDuration({ beats })).toBeGreaterThan(1);
      for (const value of beats) expect(isExpressionId(value.expression)).toBe(true);
    }
    const doubt = expandSequence('doubt-then-nod', { target: 'streamer', caption: 'Sure.' });
    expect(doubt.map((value) => value.expression)).toEqual(['skeptical', 'agreeing']);
    expect(doubt[0]?.caption).toBe('Sure.');
    expect(doubt.every((value) => value.target === 'streamer')).toBe(true);
  });
  it('clamps intensity into the expression range', () => {
    expect(beat('bored', { intensity: 1 }).intensity).toBe(expressions.bored.intensity.max);
    expect(beat('celebrate', { intensity: 0 }).intensity).toBe(expressions.celebrate.intensity.min);
  });
});
