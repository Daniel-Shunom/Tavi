// Lyla v2's mouth library: exactly one mouth visible at a time, every expression maps to a valid
// shape, and opening, widening and swapping stay continuous (swaps hide inside a squash pop).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { beat, type ExpressionScript } from '../shared/cue';
import { expressionIds, type ExpressionId } from '../shared/expressions';
import { MOUTH_SHAPE_COUNT, mouthShapeTime } from '../src/renderer/characters/mascot-v2/mouth';
import { characters } from '../src/renderer/characters/registry';
import { phaseLookup } from '../src/renderer/compose';
import { FaceLayer, MOUTH_SWAP } from '../src/renderer/face/faceLayer';
import { sampleFacePose } from '../src/renderer/face/pose';
import { sampleScript } from '../src/renderer/timeline';

const source = readFileSync('art/mascot-remix/scene.rml', 'utf8');
const LINE = '0:552';

function animation(name: string) {
  const start = source.search(new RegExp(`<LinearAnimation [^>]*?name="${name}"`));
  expect(start, name).toBeGreaterThanOrEqual(0);
  return source.slice(start, source.indexOf('</LinearAnimation>', start));
}
function keyedProperty(body: string, objectId: string, property: string) {
  const object = new RegExp(
    `<KeyedObject objectId="${objectId}"[^>]*>([\\s\\S]*?)</KeyedObject>`,
  ).exec(body)?.[1];
  const prop = object
    ? new RegExp(`<KeyedProperty property="${property}"[^>]*>([\\s\\S]*?)</KeyedProperty>`).exec(
        object,
      )?.[1]
    : undefined;
  if (!prop) throw new Error(`no ${property} keys on ${objectId}`);
  return prop;
}
/** Held value at `frame` from hold keys (value at the last key at or before it). */
function held(keys: [number, string][], frame: number) {
  let value = keys[0]?.[1];
  for (const [at, next] of keys) if (at <= frame) value = next;
  return value;
}
const manifest = characters.get('mascot-v2');
const face = manifest?.face;
if (!manifest || !face) throw new Error('mascot-v2 face missing');

describe('Lyla v2 mouth library', () => {
  const body = animation('tavi/mouthShape');
  const soloId = /name="tavi\/mouth\/shapes" id="([^"]+)"/.exec(source)?.[1] ?? '';
  const selection = [
    ...keyedProperty(body, soloId, 'activeComponentId').matchAll(
      /<KeyFrameId value="([^"]+)" frame="(\d+)"/g,
    ),
  ].map((m) => [Number(m[2]), m[1] ?? ''] as [number, string]);
  const line = [
    ...keyedProperty(body, LINE, 'opacity').matchAll(
      /<KeyFrameDouble value="([^"]+)" interpolationType="hold" frame="(\d+)"/g,
    ),
  ].map((m) => [Number(m[2]), m[1] ?? ''] as [number, string]);
  /** Whether the selected shape node draws anything. */
  const draws = (nodeId: string) => {
    const open = new RegExp(`<Node name="[^"]*" id="${nodeId}">(</Node>)?`).exec(source);
    return Boolean(open && !open[1]);
  };

  it('has the authored shape count, with the closed line as shape 0', () => {
    expect(selection.length).toBe(MOUTH_SHAPE_COUNT);
    expect(line.length).toBe(MOUTH_SHAPE_COUNT);
    expect(draws(selection[0]?.[1] ?? '')).toBe(false);
  });
  it('never shows the closed line and an open shape at once', () => {
    for (let shape = 0; shape < MOUTH_SHAPE_COUNT; shape++) {
      const frame = mouthShapeTime(shape) * 10 * MOUTH_SHAPE_COUNT;
      const lineVisible = Number(held(line, frame)) > 0.01;
      const shapeVisible = draws(held(selection, frame) ?? '');
      expect(lineVisible && shapeVisible, `shape ${String(shape)}`).toBe(false);
      expect(lineVisible || shapeVisible, `shape ${String(shape)} shows a mouth`).toBe(true);
    }
  });
  it('maps every expression to a valid mouth shape at every intensity and moment', () => {
    for (const id of expressionIds) {
      const def = face.poses[id];
      if (!def) continue;
      for (const intensity of [0.25, 0.6, 1])
        for (let t = 0; t < 7; t += 0.1) {
          const shape = sampleFacePose(def, intensity, t).mouthShape ?? 0;
          expect(Number.isInteger(shape), `${id} ${String(shape)}`).toBe(true);
          expect(shape).toBeGreaterThanOrEqual(0);
          expect(shape).toBeLessThan(MOUTH_SHAPE_COUNT);
        }
    }
  });
  it('swaps shapes only at the bottom of a squash pop, and keeps the axes continuous', () => {
    const lookup = phaseLookup(manifest);
    const pairs: [ExpressionId, ExpressionId][] = [
      ['content', 'laugh'],
      ['laugh', 'shocked'],
      ['shocked', 'wave'],
      ['wave', 'startled'],
      ['excited', 'smirk'],
      ['worried', 'grin'],
      ['innocent', 'sleepy'],
    ];
    for (const [a, b] of pairs) {
      const script: ExpressionScript = {
        id: 'cue',
        sourceEventId: 'event',
        source: 'manual',
        decidedBy: { kind: 'manual', label: 'Studio' },
        priority: 3,
        startAt: 0,
        expiresAt: 60000,
        beats: [
          { ...beat(a, { hold: 1.2, intensity: 1, target: 'chat' }), offset: 0 },
          { ...beat(b, { hold: 1.2, intensity: 1, target: 'chat' }), offset: 1.3 },
        ],
        settle: true,
        dropped: [],
      };
      const layer = new FaceLayer(face, { ownBlinks: false });
      let previous = { mouthOpen: 0, mouthWide: 0, mouthTilt: 0, mouthShape: 0 };
      for (let frame = 0; frame < 60 * 8; frame++) {
        const time = frame / 60;
        const v = layer.update({
          dt: 1 / 60,
          time,
          cues: sampleScript(script, time * 1000, lookup),
        }).values;
        const now = {
          mouthOpen: v.mouthOpen ?? 0,
          mouthWide: v.mouthWide ?? 0,
          mouthTilt: v.mouthTilt ?? 0,
          mouthShape: v.mouthShape ?? 0,
        };
        for (const axis of ['mouthOpen', 'mouthWide', 'mouthTilt'] as const)
          expect(Math.abs(now[axis] - previous[axis]), `${a}->${b} ${axis}`).toBeLessThan(0.2);
        if (now.mouthShape !== previous.mouthShape)
          expect(v.mouthPop ?? 0, `${a}->${b} swap at ${time.toFixed(2)}`).toBeGreaterThan(0.85);
        previous = now;
      }
      expect(previous.mouthShape, `${a}->${b} ends on the closed line`).toBe(0);
    }
    expect(MOUTH_SWAP).toBeLessThanOrEqual(0.1);
  });
});
