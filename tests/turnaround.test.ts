// Lyla v2's three-quarter turnaround (tools/mascot-remix/steps/turn.mjs): authored tracks in the
// built file, continuous values, no clash with other timelines, and the manifest hook-up.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { manifestSchema } from '../src/renderer/characters/manifest';
import { mascotV2 } from '../src/renderer/characters/mascot-v2/manifest';
import { mascotV2Motion, turnTime } from '../src/renderer/characters/mascot-v2/motion';
import { neutralPose } from '../src/renderer/motion/types';
// @ts-expect-error -- plain .mjs pipeline module without type declarations
import * as turnStep from '../tools/mascot-remix/steps/turn.mjs';

const { addTurnaround } = turnStep as { addTurnaround: (rml: string) => string };

const source = readFileSync('art/mascot-remix/scene.rml', 'utf8');
const TRACKS = ['tavi/turnHead', 'tavi/turnBody'];

/** Body of a named animation in the source. */
function animation(name: string) {
  const start = source.search(new RegExp(`<LinearAnimation [^>]*?name="${name}"`));
  expect(start, name).toBeGreaterThanOrEqual(0);
  return source.slice(start, source.indexOf('</LinearAnimation>', start));
}
/** "objectId.property" -> sorted [frame, value] keys, for every keyed property in `body`. */
function keyedProperties(body: string) {
  const out = new Map<string, [number, number][]>();
  for (const object of body.matchAll(
    /<KeyedObject objectId="([^"]+)"[^>]*>([\s\S]*?)<\/KeyedObject>/g,
  ))
    for (const prop of (object[2] ?? '').matchAll(
      /<KeyedProperty property="([^"]+)"[^>]*>([\s\S]*?)<\/KeyedProperty>/g,
    ))
      out.set(
        `${object[1] ?? ''}.${prop[1] ?? ''}`,
        [...(prop[2] ?? '').matchAll(/<KeyFrameDouble value="([^"]+)"[^>]*?frame="(\d+)"/g)].map(
          (m) => [Number(m[2]), Number(m[1])] as [number, number],
        ),
      );
  return out;
}

describe('Lyla v2 turnaround', () => {
  it('ships both control tracks in the built file', () => {
    const riv = readFileSync('src/renderer/characters/mascot-v2/mascot-v2.riv').toString('latin1');
    for (const name of TRACKS) expect(riv.includes(name), name).toBe(true);
  });

  it('is authored idempotently by its own pipeline step', () => {
    expect(addTurnaround(source)).toBe(source);
  });

  it('keys continuous values that rest at frame 30 on the authored pose', () => {
    for (const name of TRACKS) {
      const props = keyedProperties(animation(name));
      expect(props.size, name).toBeGreaterThan(5);
      for (const [key, frames] of props) {
        expect(frames.map(([frame]) => frame)).toEqual([0, 6, 12, 18, 24, 30, 36, 42, 48, 54, 60]);
        // Frame 30 (facing the camera) is the authored value of the property.
        const [id = '', property = ''] = key.split('.');
        const tag = new RegExp(`<[A-Za-z]+ [^>]*? id="${id}"[^>]*>`).exec(source)?.[0] ?? '';
        const rest = new RegExp(`\\s${property}="([^"]*)"`).exec(tag)?.[1];
        const defaults: Record<string, number> = { scaleX: 1, scaleY: 1, opacity: 1, x: 0, y: 0 };
        const expected = rest === undefined ? defaults[property] : Number(rest);
        if (expected !== undefined) expect(frames[5]?.[1], key).toBeCloseTo(expected, 3);
        // No jumps: neighbouring samples (0.2 of the turn apart) stay close.
        const limit = property === 'opacity' ? 0.6 : property.startsWith('scale') ? 0.1 : 6;
        for (let i = 1; i < frames.length; i++)
          expect(Math.abs((frames[i]?.[1] ?? 0) - (frames[i - 1]?.[1] ?? 0)), key).toBeLessThan(
            limit,
          );
      }
    }
  });

  it('keys nothing another timeline keys, so it layers over clips, gaits and joysticks', () => {
    const own = new Set<string>();
    for (const name of TRACKS)
      for (const key of keyedProperties(animation(name)).keys()) own.add(key);
    for (const match of source.matchAll(/<LinearAnimation [^>]*?name="([^"]+)"/g)) {
      const name = match[1] ?? '';
      if (TRACKS.includes(name)) continue;
      for (const key of keyedProperties(animation(name)).keys())
        expect(own.has(key), `${key} also keyed by ${name}`).toBe(false);
    }
  });

  it('is exposed through the manifest with turnStyle "authored"', () => {
    const manifest = manifestSchema.parse(mascotV2);
    expect(manifest.turnStyle).toBe('authored');
    expect(manifest.tracks['ctl.turn-head']).toBe('tavi/turnHead');
    expect(manifest.tracks['ctl.turn-body']).toBe('tavi/turnBody');
    expect(manifest.motionTracks).toEqual(
      expect.arrayContaining(['ctl.turn-head', 'ctl.turn-body']),
    );
  });

  it('maps the turn channels onto the tracks (frame 30 faces the camera)', () => {
    expect(turnTime(0)).toBeCloseTo(0.5);
    expect(turnTime(-1)).toBe(0);
    expect(turnTime(0.6)).toBeCloseTo(0.8);
    const pose = { ...neutralPose(), turnHead: 0.6, turnBody: -0.3 };
    const bound = mascotV2Motion.bind({
      time: 0,
      pose,
      clips: [],
      placement: {
        x: 0.5,
        y: 0.9,
        lean: 0,
        facing: 1,
        scaleX: 1,
        scaleY: 1,
        opacity: 1,
        clipBelow: null,
      },
      shadow: { x: 0.5, y: 0.9, scale: 1, opacity: 0.5 },
      status: {
        airborne: 0,
        expressions: [],
        locomotion: 'idle',
        choreography: null,
        fidget: null,
        hidden: false,
      },
    });
    const sample = (track: string) => bound.tracks.find((t) => t.track === track)?.time;
    expect(sample('ctl.turn-head')).toBeCloseTo(0.8);
    expect(sample('ctl.turn-body')).toBeCloseTo(0.35);
  });
});
