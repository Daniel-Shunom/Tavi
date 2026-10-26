import { describe, expect, it } from 'vitest';
import { beat, expandSequence, type ExpressionScript } from '../shared/cue';
import { hiddenAmount, pickChoreography } from '../shared/presence';
import { locomotionTarget, wanderTarget } from '../shared/locomotion';
import { composePose, phaseLookup } from '../src/renderer/compose';
import { getCharacter } from '../src/renderer/characters/registry';
import { IdleScheduler } from '../src/renderer/idle';
import { Performer, sampleScript } from '../src/renderer/timeline';

const mascot = getCharacter('mascot');
function script(
  beats: ExpressionScript['beats'],
  options: Partial<ExpressionScript> = {},
): ExpressionScript {
  return {
    id: 'cue-1',
    sourceEventId: 'event-1',
    source: 'manual',
    decidedBy: { kind: 'manual', label: 'Studio' },
    priority: 3,
    startAt: 10_000,
    expiresAt: 13_000,
    beats,
    settle: true,
    dropped: [],
    ...options,
  };
}
const lookup = () => ({ anticipation: 0.3, recovery: 0.5 });

describe('cue timeline', () => {
  it('moves each beat through anticipation, hold and recovery, then back to idle', () => {
    const cue = script([beat('skeptical', { hold: 1 })]);
    expect(sampleScript(cue, 9_900, lookup)).toEqual([]);
    expect(sampleScript(cue, 10_150, lookup)[0]?.phase).toBe('anticipation');
    expect(sampleScript(cue, 10_800, lookup)[0]).toMatchObject({ phase: 'hold', weight: 1 });
    expect(sampleScript(cue, 11_500, lookup)[0]?.phase).toBe('recovery');
    expect(sampleScript(cue, 12_000, lookup)).toEqual([]);
  });
  it('chains beats: a newer beat on the same channel takes over, other channels layer', () => {
    const cue = script(expandSequence('doubt-then-nod'));
    const during = sampleScript(cue, 10_000 + 2_300, lookup);
    expect(during.find((layer) => layer.expression === 'agreeing')?.weight).toBe(1);
    const layered = script([
      beat('wave', { hold: 2 }),
      beat('listening', { hold: 2, target: 'chat' }),
    ]);
    expect(
      sampleScript(layered, 11_000, lookup)
        .map((layer) => layer.expression)
        .sort(),
    ).toEqual(['listening', 'wave']);
    const replaced = script([beat('content', { hold: 3 }), beat('amused', { offset: 1, hold: 1 })]);
    const content = sampleScript(replaced, 11_800, lookup).find(
      (layer) => layer.expression === 'content',
    );
    expect(content).toBeUndefined();
  });
  it('holds open-ended listening/thinking cues until replaced', () => {
    const cue = script(
      [beat('listening', { hold: 1 }), beat('thinking', { offset: 0.9, hold: 1 })],
      { settle: false },
    );
    const later = sampleScript(cue, 60_000, lookup);
    // Both are the last beat on their channel, so both hold until the decision replaces them.
    expect(later.map((layer) => layer.expression)).toEqual(['listening', 'thinking']);
  });
  it('fades out an interrupted script instead of snapping, and never replays old cues', () => {
    const performer = new Performer(lookup, 0.35);
    performer.set(script([beat('celebrate', { hold: 2 })]), 10_000);
    performer.set(script([beat('wave', { hold: 2 })], { id: 'cue-2', startAt: 10_800 }), 10_800);
    const mixed = performer.sample(10_900);
    expect(mixed.find((layer) => layer.expression === 'celebrate')?.weight).toBeGreaterThan(0);
    expect(mixed.find((layer) => layer.expression === 'celebrate')?.weight).toBeLessThan(1);
    expect(performer.sample(11_400).some((layer) => layer.expression === 'celebrate')).toBe(false);
    const reconnect = new Performer(lookup);
    reconnect.set(script([beat('celebrate', { hold: 2 })]), 40_000);
    expect(reconnect.sample(40_000)).toEqual([]);
  });
});

describe('pose composition', () => {
  const at = (expression: Parameters<typeof beat>[0], options: Parameters<typeof beat>[1] = {}) =>
    sampleScript(script([beat(expression, { hold: 2, ...options })]), 11_000, phaseLookup(mascot));
  it('makes the six core reactions visibly distinct', () => {
    const signatures = [
      at('listening', { target: 'streamer' }),
      at('skeptical'),
      at('innocent'),
      at('impressed'),
      at('celebrate'),
      at('wave'),
    ].map((layers) => {
      const pose = composePose(layers, mascot, { side: () => 1 });
      return JSON.stringify([
        pose.tracks.map((track) => [track.track, track.time.toFixed(2)]),
        Math.round(pose.offset.x),
        Math.round(pose.offset.rotation),
      ]);
    });
    expect(new Set(signatures).size).toBe(6);
  });
  it('honours reduced motion: no host movement or oscillation, clips held still', () => {
    const pose = composePose(at('agreeing'), mascot, { reducedMotion: true });
    expect(pose.offset).toEqual({ x: 0, y: 0, rotation: 0, scale: 1 });
    const playing = composePose(at('wave'), mascot, { reducedMotion: true });
    expect(playing.tracks[0]?.time).toBe(0.5);
  });
  it('turns toward the attention target and scales with energy and attitude', () => {
    const left = composePose(at('listening', { target: 'chat' }), mascot, { side: () => -1 });
    const right = composePose(at('listening', { target: 'chat' }), mascot, { side: () => 1 });
    expect(Math.sign(left.offset.rotation)).toBe(-1);
    expect(Math.sign(right.offset.rotation)).toBe(1);
    const gentle = composePose(at('skeptical'), mascot, { attitude: 'gentle', energy: 0 });
    const spicy = composePose(at('skeptical'), mascot, { attitude: 'spicy', energy: 100 });
    expect(Math.abs(spicy.offset.rotation)).toBeGreaterThan(Math.abs(gentle.offset.rotation));
  });
  it('uses intensity variants and surfaces captions during the hold', () => {
    const subtle = composePose(at('skeptical', { intensity: 0.2 }), mascot);
    const normal = composePose(at('skeptical', { intensity: 0.6 }), mascot);
    expect(subtle.tracks.length).toBe(1);
    expect(normal.tracks.length).toBe(2);
    expect(composePose(at('teasing', { caption: 'Mhm.' }), mascot).caption).toBe('Mhm.');
  });
});

describe('idle life', () => {
  it('varies small behaviours, never repeats immediately, and stops when suppressed', () => {
    const idle = new IdleScheduler({
      supported: ['idle-glance', 'idle-fidget'],
      seed: 3,
      minGap: 1,
      maxGap: 2,
    });
    const seen: string[] = [];
    for (let time = 0; time < 40; time += 0.1) {
      const layer = idle.sample(time, false, false)[0];
      if (layer && seen.at(-1) !== layer.expression) seen.push(layer.expression);
    }
    expect(seen.length).toBeGreaterThan(4);
    for (let index = 1; index < seen.length; index++) expect(seen[index]).not.toBe(seen[index - 1]);
    for (let time = 40; time < 80; time += 0.1) expect(idle.sample(time, false, true)).toEqual([]);
    for (let time = 80; time < 120; time += 0.1) expect(idle.sample(time, true, false)).toEqual([]);
  });
});

describe('locomotion and presence cues', () => {
  it('heads to the cue destination, then home after a timed visit', () => {
    const movement = {
      id: 'm',
      sourceEventId: 'e',
      source: 'chat' as const,
      decidedBy: { kind: 'ai' as const, label: 'AI' },
      priority: 1,
      kind: 'move-to' as const,
      to: { x: 0.8, y: 0.6 },
      startAt: 1000,
      expiresAt: 4000,
      stay: 5,
    };
    const home = { x: 0.2, y: 0.7 };
    expect(locomotionTarget(movement, home, 2000, 2).to).toEqual({ x: 0.8, y: 0.6 });
    expect(locomotionTarget(movement, home, 9000, 2).to).toEqual(home);
    expect(locomotionTarget(null, home, 9000).to).toEqual(home);
    const wander = wanderTarget({ x: 0.9, y: 0.7 }, 'seed');
    expect(wander.x).toBeLessThanOrEqual(0.92);
    expect(Math.abs(wander.x - 0.9)).toBeGreaterThan(0.03);
  });
  it('plays the same choreography everywhere and resumes an interrupted entrance smoothly', () => {
    expect(pickChoreography('random', 5)).toBe(pickChoreography('random', 5));
    expect(pickChoreography('random', 5, pickChoreography('random', 5))).not.toBe(
      pickChoreography('random', 5),
    );
    expect(pickChoreography('climb', 5)).toBe('climb');
    const enter = {
      id: 'a',
      kind: 'enter' as const,
      choreography: 'drop' as const,
      seed: 1,
      startAt: 0,
      from: 1,
    };
    expect(hiddenAmount(enter, 0)).toBe(1);
    expect(hiddenAmount(enter, 800)).toBeCloseTo(0.5);
    const exit = { ...enter, kind: 'exit' as const, startAt: 800, from: hiddenAmount(enter, 800) };
    expect(hiddenAmount(exit, 800)).toBeCloseTo(0.5);
    expect(hiddenAmount(exit, 5000)).toBe(1);
    expect(hiddenAmount(exit, 800, true)).toBe(1);
  });
});
