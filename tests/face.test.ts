import { describe, expect, it } from 'vitest';
import { beat, type ExpressionScript } from '../shared/cue';
import { expressionIds, expressions, type ExpressionId } from '../shared/expressions';
import { characters } from '../src/renderer/characters/registry';
import { phaseLookup } from '../src/renderer/compose';
import { faceChannels, type FaceChannel } from '../src/renderer/face/channels';
import { FaceLayer, type FaceCue } from '../src/renderer/face/faceLayer';
import { sampleFacePose, type CharacterFace } from '../src/renderer/face/pose';
import { stepSpring } from '../src/renderer/face/spring';
import { sampleScript } from '../src/renderer/timeline';

const mascot = characters.get('mascot');
if (!mascot?.face) throw new Error('mascot face missing');
const face: CharacterFace = mascot.face;
const poseIds = Object.keys(face.poses) as ExpressionId[];
const facial = [
  'soft-smile',
  'grin',
  'laugh',
  'smirk',
  'eye-roll',
  'suspicious',
  'deadpan',
  'focused',
  'determined',
  'frown',
  'pout',
  'annoyed',
  'sad',
  'worried',
  'wince',
  'grossed-out',
  'shocked',
  'sleepy',
] as const;

function script(steps: { id: ExpressionId; offset: number; hold: number; intensity?: number }[]) {
  return {
    id: 'cue',
    sourceEventId: 'event',
    source: 'manual',
    decidedBy: { kind: 'manual', label: 'Studio' },
    priority: 3,
    startAt: 0,
    expiresAt: 60000,
    beats: steps.map((step) => ({
      ...beat(step.id, { hold: step.hold, intensity: step.intensity ?? 0.7, target: 'chat' }),
      offset: step.offset,
    })),
    settle: true,
    dropped: [],
  } satisfies ExpressionScript;
}
function cuesAt(value: ExpressionScript, seconds: number): FaceCue[] {
  return sampleScript(value, seconds * 1000, phaseLookup(mascot ?? ({} as never)));
}

describe('face pose library', () => {
  it('adds the requested facial expressions to the library, each with a face pose', () => {
    for (const id of facial) {
      expect(expressionIds).toContain(id);
      expect(expressions[id].channel).toBe('emote');
      expect(face.poses[id], id).toBeDefined();
    }
  });
  it('gives every emote on the mascot a face pose, including Oops and embarrassed', () => {
    for (const id of expressionIds)
      if (expressions[id].channel === 'emote') expect(face.poses[id], id).toBeDefined();
    expect(face.poses.innocent?.onset, 'Oops needs a startle onset').toBeDefined();
    expect(face.poses.embarrassed?.keys, 'embarrassed needs darting glances').toBeDefined();
  });
  it('keeps every pose inside the rig safe ranges at every intensity and moment', () => {
    const outside: string[] = [];
    for (const id of poseIds) {
      const def = face.poses[id];
      if (!def) continue;
      for (const intensity of [0.15, 0.25, 0.4, 0.6, 0.8, 1])
        for (let t = 0; t <= 8; t += 0.05) {
          const values = sampleFacePose(def, intensity, t);
          for (const [name, value] of Object.entries(values) as [FaceChannel, number][]) {
            const range = face.channels[name];
            if (!range || value < range.min - 1e-9 || value > range.max + 1e-9)
              outside.push(
                `${id}@${String(intensity)} t=${t.toFixed(2)} ${name}=${value.toFixed(3)}`,
              );
          }
        }
    }
    expect(outside.slice(0, 10)).toEqual([]);
  });
  it('distinguishes every pose from every other at typical intensity', () => {
    const close: string[] = [];
    const looks = poseIds.map(
      (id) => [id, sampleFacePose(face.poses[id] ?? { pose: {} }, 0.6, 1.5)] as const,
    );
    for (let a = 0; a < looks.length; a++)
      for (let b = a + 1; b < looks.length; b++) {
        const [idA, A] = looks[a] ?? ['', {}];
        const [idB, B] = looks[b] ?? ['', {}];
        let distance = 0;
        for (const name of faceChannels) distance += Math.abs((A[name] ?? 0) - (B[name] ?? 0));
        if (distance < 0.6) close.push(`${idA}~${idB} (${distance.toFixed(2)})`);
      }
    expect(close).toEqual([]);
  });
});

describe('face layer', () => {
  it('moves continuously through transitions between any two expressions', () => {
    const jumps: string[] = [];
    const ids = poseIds;
    for (let index = 0; index < ids.length; index++) {
      const a = ids[index],
        b = ids[(index + 7) % ids.length];
      if (!a || !b) continue;
      const cue = script([
        { id: a, offset: 0, hold: 1.2 },
        { id: b, offset: 1.3, hold: 1.2, intensity: 1 },
      ]);
      const layer = new FaceLayer(face, { ownBlinks: false });
      let previous = layer.update({ dt: 1 / 60, time: 0, cues: cuesAt(cue, 0) }).values;
      for (let frame = 1; frame < 60 * 4; frame++) {
        const time = frame / 60;
        const values = layer.update({ dt: 1 / 60, time, cues: cuesAt(cue, time) }).values;
        for (const name of faceChannels) {
          const delta = Math.abs((values[name] ?? 0) - (previous[name] ?? 0));
          // Fast but continuous: a full-range change takes at least ~5 frames (startles are quick).
          const limit = name === 'headTilt' ? 0.03 : 0.3;
          if (delta > limit)
            jumps.push(`${a}->${b} ${name} ${delta.toFixed(3)} @${time.toFixed(2)}`);
        }
        previous = values;
      }
    }
    expect(jumps.slice(0, 10)).toEqual([]);
  });
  it('lets the brows lead and the mouth follow (overlapping action)', () => {
    const layer = new FaceLayer(face, { ownBlinks: false });
    const cues: FaceCue[] = [{ expression: 'frown', intensity: 0.6, weight: 1, elapsed: 1 }];
    const goal = sampleFacePose(face.poses.frown ?? { pose: {} }, 0.6, 1);
    let browAt = -1,
      mouthAt = -1;
    for (let frame = 1; frame < 120; frame++) {
      const time = frame / 120;
      const values = layer.update({ dt: 1 / 120, time, cues, reducedMotion: true }).values;
      if (browAt < 0 && (values.browL ?? 0) >= 0.5 * (goal.browL ?? 0)) browAt = time;
      if (mouthAt < 0 && (values.smile ?? 0) <= 0.5 * (goal.smile ?? 0)) mouthAt = time;
    }
    expect(browAt).toBeGreaterThan(0);
    expect(mouthAt - browAt).toBeGreaterThanOrEqual(0.05);
    expect(mouthAt - browAt).toBeLessThanOrEqual(0.12);
  });
  it('never holds a face perfectly still', () => {
    const still: string[] = [];
    for (const id of poseIds) {
      const layer = new FaceLayer(face, { ownBlinks: false });
      const samples: string[] = [];
      for (let frame = 0; frame < 60 * 4; frame++) {
        const time = frame / 60;
        const values = layer.update({
          dt: 1 / 60,
          time,
          cues: [{ expression: id, intensity: 0.6, weight: 1, elapsed: time }],
        }).values;
        if (frame % 40 === 39) samples.push(JSON.stringify(values));
      }
      if (new Set(samples).size < samples.length) still.push(id);
    }
    expect(still).toEqual([]);
  });
  it('blinks at the pose rate, stares when the rate is zero, and stays within 0..1', () => {
    const count = (expression: ExpressionId) => {
      const layer = new FaceLayer(face, { seed: 3 });
      let blinks = 0,
        closed = false;
      for (let frame = 0; frame < 60 * 30; frame++) {
        const time = frame / 60;
        const value =
          layer.update({
            dt: 1 / 60,
            time,
            cues: [{ expression, intensity: 0.6, weight: 1, elapsed: time }],
          }).values.blinkL ?? 0;
        expect(value).toBeLessThanOrEqual(1);
        expect(value).toBeGreaterThanOrEqual(0);
        if (!closed && value > 0.9) blinks++;
        closed = value > 0.9;
      }
      return blinks;
    };
    expect(count('shocked')).toBe(0);
    expect(count('worried')).toBeGreaterThan(count('deadpan'));
    expect(count('listening')).toBeGreaterThanOrEqual(3);
  });
  it('is frame-rate independent', () => {
    const run = (fps: number) => {
      const state = { value: 0, velocity: 0 };
      for (let frame = 0; frame < fps * 0.5; frame++) stepSpring(state, 1, 0.05, 1 / fps);
      return state.value;
    };
    expect(Math.abs(run(30) - run(120))).toBeLessThan(1e-9);
  });
});
