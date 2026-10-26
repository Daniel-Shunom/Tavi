// Lyla v2's opening mouth: one mouth representation at a time, and continuous opening/closing.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { beat, type ExpressionScript } from '../shared/cue';
import type { ExpressionId } from '../shared/expressions';
import { characters } from '../src/renderer/characters/registry';
import { phaseLookup } from '../src/renderer/compose';
import { FaceLayer } from '../src/renderer/face/faceLayer';
import { sampleScript } from '../src/renderer/timeline';

const source = readFileSync('art/mascot-remix/scene.rml', 'utf8');
const LINE = '0:552';

/** Linear keyframes [frame, value] of `property` on `objectId` in the named animation. */
function keys(animation: string, objectId: string, property: string): [number, number][] {
  const start = source.search(new RegExp(`<LinearAnimation [^>]*?name="${animation}"`));
  expect(start, animation).toBeGreaterThanOrEqual(0);
  const body = source.slice(start, source.indexOf('</LinearAnimation>', start));
  const object = new RegExp(
    `<KeyedObject objectId="${objectId}"[^>]*>([\\s\\S]*?)</KeyedObject>`,
  ).exec(body)?.[1];
  const prop = object
    ? new RegExp(`<KeyedProperty property="${property}"[^>]*>([\\s\\S]*?)</KeyedProperty>`).exec(
        object,
      )?.[1]
    : undefined;
  if (!prop) throw new Error(`no ${property} keys on ${objectId} in ${animation}`);
  return [...prop.matchAll(/<KeyFrameDouble value="([^"]+)"[^>]*?frame="(\d+)"/g)].map(
    (m) => [Number(m[2]), Number(m[1])] as [number, number],
  );
}
function at(frames: [number, number][], frame: number) {
  const first = frames[0],
    last = frames[frames.length - 1];
  if (!first || !last) return 0;
  if (frame <= first[0]) return first[1];
  if (frame >= last[0]) return last[1];
  for (let i = 1; i < frames.length; i++) {
    const a = frames[i - 1],
      b = frames[i];
    if (a && b && frame <= b[0]) return a[1] + ((b[1] - a[1]) * (frame - a[0])) / (b[0] - a[0]);
  }
  return last[1];
}
const interiorId = /name="tavi\/mouthInterior" id="([^"]+)"/.exec(source)?.[1] ?? '';
const lowerLipId = /name="lower lip" id="([^"]+)"/.exec(source)?.[1] ?? '';

describe('Lyla v2 mouth', () => {
  it('never shows the closed line and the open mouth at once', () => {
    const line = keys('tavi/mouthOpen', LINE, 'opacity');
    const open = keys('tavi/mouthOpen', interiorId, 'opacity');
    expect(at(line, 0)).toBe(1);
    expect(at(open, 0)).toBe(0);
    for (let o = 0; o <= 1.0001; o += 0.0025) {
      const frame = o * 60;
      const both = Math.min(at(line, frame), at(open, frame));
      expect(both, `open ${o.toFixed(3)}`).toBeLessThanOrEqual(0.5 + 1e-9);
      if (o >= 0.1) expect(at(line, frame)).toBe(0);
    }
  });
  it('starts the open mouth flat on the line and opens continuously', () => {
    const lower = keys('tavi/mouthOpen', lowerLipId, 'y');
    // The upper lip copies the mouth line's middle vertex; the lower lip starts exactly on it.
    const upperRest = Number(/ y="([^"]+)" name="upper lip"/.exec(source)?.[1]);
    expect(at(lower, 0)).toBeCloseTo(upperRest, 6);
    let previous = at(lower, 0);
    for (let frame = 1; frame <= 60; frame++) {
      const value = at(lower, frame);
      expect(Math.abs(value - previous)).toBeLessThan(1);
      previous = value;
    }
  });
  it('drives mouthOpen continuously through expressions that open the mouth', () => {
    const manifest = characters.get('mascot-v2');
    const face = manifest?.face;
    if (!manifest || !face) throw new Error('mascot-v2 face missing');
    const lookup = phaseLookup(manifest);
    const pairs: [ExpressionId, ExpressionId][] = [
      ['content', 'laugh'],
      ['laugh', 'shocked'],
      ['shocked', 'wave'],
      ['wave', 'startled'],
      ['excited', 'content'],
      ['sleepy', 'grin'],
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
      let previous = 0;
      for (let frame = 0; frame < 60 * 5; frame++) {
        const time = frame / 60;
        const value =
          layer.update({ dt: 1 / 60, time, cues: sampleScript(script, time * 1000, lookup) }).values
            .mouthOpen ?? 0;
        expect(Math.abs(value - previous), `${a}->${b} @${time.toFixed(2)}`).toBeLessThan(0.2);
        expect(value).toBeGreaterThanOrEqual(0);
        previous = value;
      }
      expect(previous, `${a}->${b} closes back to the line`).toBeLessThan(0.01);
    }
  });
});
