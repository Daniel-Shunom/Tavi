// Lyla v2's three-quarter turnaround (tools/mascot-remix/steps/turn.mjs): authored tracks in the
// built file, continuous values, no clash with other timelines, and the manifest hook-up.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { manifestSchema } from '../src/renderer/characters/manifest';
import { mascotV2 } from '../src/renderer/characters/mascot-v2/manifest';
import { mascotV2Motion, turnTime } from '../src/renderer/characters/mascot-v2/motion';
import { neutralPose, type MotionFrame } from '../src/renderer/motion/types';
import { MotionLayer } from '../src/renderer/motion/motion';
// @ts-expect-error -- plain .mjs pipeline module without type declarations
import * as turnStep from '../tools/mascot-remix/steps/turn.mjs';
// @ts-expect-error -- plain .mjs pipeline module without type declarations
import * as skirtStep from '../tools/mascot-remix/steps/skirt.mjs';

const { addTurnaround } = turnStep as { addTurnaround: (rml: string) => string };

function boundEyeX(frame: MotionFrame) {
  const eyes = mascotV2Motion.bind(frame).nodes['eyes'];
  if (!eyes || eyes.x === undefined) throw new Error('Mascot v2 binding must expose pupil X');
  return eyes.x;
}

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
  )) {
    for (const prop of (object[2] ?? '').matchAll(
      /<KeyedProperty property="([^"]+)"[^>]*>([\s\S]*?)<\/KeyedProperty>/g,
    )) {
      if (!prop[2]?.includes('<KeyFrameDouble')) continue;
      out.set(
        `${object[1] ?? ''}.${prop[1] ?? ''}`,
        [...prop[2].matchAll(/<KeyFrameDouble value="([^"]+)"[^>]*?frame="(\d+)"/g)].map(
          (m) => [Number(m[2]), Number(m[1])] as [number, number],
        ),
      );
    }
  }
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

  it('keeps the skirt panels on the hip instead of weighted to the legs', () => {
    const { attachSkirt } = skirtStep as { attachSkirt: (rml: string) => string };
    expect(attachSkirt(source)).toBe(source);
    const hip = source.indexOf('name="pants" id="0:635"');
    const firstLeg = source.indexOf('name="IK  LEFT  LEG "', hip);
    for (const id of ['0:636', '0:646']) {
      const start = source.indexOf(`id="${id}"`, hip);
      expect(start).toBeGreaterThan(hip);
      expect(start).toBeLessThan(firstLeg);
      const pathStart = source.indexOf('<PointsPath', start);
      const pathEnd = source.indexOf('</PointsPath>', pathStart);
      expect(source.slice(pathStart, pathEnd)).not.toContain('<Skin');
    }
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

  it('keys no numeric properties used by other clips, gaits or joysticks', () => {
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

  it('projects the head silhouette as well as moving the face plane', () => {
    const props = keyedProperties(animation('tavi/turnHead'));
    const width = props.get('0:568.scaleX');
    expect(width, 'face silhouette must narrow into the turn').toBeDefined();
    expect(width?.[0]?.[1]).toBeLessThan(0.9);
    expect(width?.[5]?.[1]).toBe(1);
    expect(width?.[10]?.[1]).toBeLessThan(0.9);
    const plane = props.get('0:1284.x') ?? [];
    expect((plane[10]?.[1] ?? 0) - (plane[0]?.[1] ?? 0)).toBeGreaterThan(45);
  });

  it('turns the chest and shoulders asymmetrically in both directions', () => {
    const props = keyedProperties(animation('tavi/turnBody'));
    const leftChest = props.get('0:614.scaleX') ?? [];
    const rightChest = props.get('0:625.scaleX') ?? [];
    expect(leftChest[0]?.[1]).toBeLessThan(rightChest[0]?.[1] ?? 0);
    expect(rightChest[10]?.[1]).toBeLessThan(leftChest[10]?.[1] ?? 0);
    expect(leftChest[5]?.[1]).toBe(1);
    expect(rightChest[5]?.[1]).toBe(1);
    const leftArm = props.get('0:2090.scaleX') ?? [];
    const rightArm = props.get('0:2339.scaleX') ?? [];
    expect(leftArm[0]?.[1]).toBeLessThan(leftArm[5]?.[1] ?? 0);
    expect(rightArm[10]?.[1]).toBeLessThan(rightArm[5]?.[1] ?? 0);
  });

  it('does not resize either leg group as the body turns', () => {
    const props = keyedProperties(animation('tavi/turnBody'));
    for (const id of ['0:2518', '0:2507']) {
      expect(props.has(`${id}.x`)).toBe(true);
      expect(props.has(`${id}.scaleX`)).toBe(false);
      expect(props.has(`${id}.scaleY`)).toBe(false);
    }
  });

  it('points both IK knee bends into the selected three-quarter view', () => {
    const body = animation('tavi/turnBody');
    for (const [id, switchFrame] of [
      ['0:2560', 30],
      ['0:2505', 30],
    ] as const) {
      const object =
        new RegExp(`<KeyedObject objectId="${id}"[^>]*>([\\s\\S]*?)</KeyedObject>`).exec(
          body,
        )?.[1] ?? '';
      expect(object).toContain('property="invertDirection"');
      expect(object).toMatch(/<KeyFrameBool value="false" frame="0"/);
      expect(object).toContain(`<KeyFrameBool value="true" frame="${String(switchFrame)}"`);
    }
  });

  it('extends the shoe silhouette toward the facing direction', () => {
    const props = keyedProperties(animation('tavi/turnBody'));
    for (const id of ['0:13098', '0:13191']) {
      const toe = props.get(`${id}.x`) ?? [];
      expect(toe[10]?.[1]).toBeGreaterThan(toe[5]?.[1] ?? Infinity);
    }
    for (const id of ['0:13100', '0:13195']) {
      const toe = props.get(`${id}.x`) ?? [];
      expect(toe[0]?.[1]).toBeLessThan(toe[5]?.[1] ?? -Infinity);
    }
  });

  it('keeps the two shirt panels overlapping through the turn', () => {
    const props = keyedProperties(animation('tavi/turnBody'));
    const leftX = props.get('0:614.x') ?? [];
    const rightX = props.get('0:625.x') ?? [];
    const leftScale = props.get('0:614.scaleX') ?? [];
    const rightScale = props.get('0:625.scaleX') ?? [];
    for (let i = 0; i < leftX.length; i++) {
      // At the shirt hem these authored vertices face each other at the centre.
      const leftEdge = (leftX[i]?.[1] ?? 0) + 17.455006 * (leftScale[i]?.[1] ?? 0);
      const rightEdge = (rightX[i]?.[1] ?? 0) - 19.252001 * (rightScale[i]?.[1] ?? 0);
      expect(leftEdge, `frame ${String(leftX[i]?.[0])}`).toBeGreaterThan(rightEdge);
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

  it.each([-1, 1])('looks and turns toward a travel target on side %s', (direction) => {
    const layer = new MotionLayer(
      7,
      {
        personality: 'playful',
        attitude: 'cheeky',
        energy: 60,
        reducedMotion: false,
        quiet: false,
      },
      { aspect: 16 / 9, bodyHeight: 0.3, margin: 0.02 },
      { feet: true, turnStyle: 'authored' },
    );
    layer.place(direction > 0 ? 0.3 : 0.7, 0.9);
    layer.attend({ x: direction * 0.9, y: -0.1 });
    layer.moveTo({ x: direction > 0 ? 0.8 : 0.2, at: 0.2, gait: 'step' });
    let moving = 0;
    let final = layer.update(0);
    for (let i = 1; i <= 60 * 12; i++) {
      const frame = layer.update(i / 60);
      if (frame.status.locomotion.startsWith('moving:')) {
        moving++;
        expect(frame.pose.turnHead * frame.placement.facing * direction).toBeGreaterThan(0.3);
        expect(frame.pose.gazeX * direction).toBeGreaterThan(0);
        const pupilX = boundEyeX(frame);
        expect(pupilX * frame.placement.facing * direction).toBeGreaterThan(0);
        expect(frame.placement.facing).toBe(direction);
      }
      final = frame;
    }
    expect(moving).toBeGreaterThan(5);
    expect(Math.abs(final.pose.turnHead)).toBeLessThan(0.05);
    expect(Math.abs(final.pose.turnBody)).toBeLessThan(0.05);
    expect(final.placement.facing).toBe(1);
  });

  it('turns into the return walk before stepping and resets to idle after arriving home', () => {
    const layer = new MotionLayer(
      11,
      {
        personality: 'cozy',
        attitude: 'gentle',
        energy: 55,
        reducedMotion: false,
        quiet: false,
      },
      { aspect: 16 / 9, bodyHeight: 0.3, margin: 0.02 },
      { feet: true, turnStyle: 'authored' },
    );
    layer.place(0.3, 0.9);
    layer.moveTo({ x: 0.75, at: 0.1, gait: 'walk' });
    let frame = layer.update(0);
    for (let i = 1; i <= 60 * 12; i++) frame = layer.update(i / 60);
    expect(frame.status.locomotion).toBe('idle');
    expect(Math.abs(frame.pose.turnBody)).toBeLessThan(0.05);

    layer.moveTo({ x: 0.3, at: 12.1, gait: 'walk' });
    let sawLeftwardTravel = false;
    for (let i = 60 * 12 + 1; i <= 60 * 24; i++) {
      frame = layer.update(i / 60);
      if (!frame.status.locomotion.startsWith('moving:')) continue;
      sawLeftwardTravel = true;
      expect(frame.pose.turnHead * frame.placement.facing).toBeLessThan(-0.3);
      if (frame.time - 12.1 > 0.5)
        expect(frame.pose.turnBody * frame.placement.facing).toBeLessThan(-0.3);
      expect(frame.pose.gazeX * frame.placement.facing).toBeGreaterThan(0);
      expect(boundEyeX(frame) * frame.placement.facing).toBeLessThan(0);
      expect(frame.placement.facing).toBe(-1);
    }
    expect(sawLeftwardTravel).toBe(true);
    expect(frame.placement.x).toBeCloseTo(0.3, 2);
    expect(Math.abs(frame.pose.turnHead)).toBeLessThan(0.05);
    expect(Math.abs(frame.pose.turnBody)).toBeLessThan(0.05);
    expect(frame.placement.facing).toBe(1);
  });

  it('keeps world head and body rotation continuous across a mid-stride handedness change', () => {
    const layer = new MotionLayer(
      7,
      {
        personality: 'cozy',
        attitude: 'gentle',
        energy: 40,
        reducedMotion: false,
        quiet: false,
      },
      { aspect: 16 / 9, bodyHeight: 0.3, margin: 0.02 },
      { feet: true, turnStyle: 'authored', authored: ['walk'] },
    );
    layer.place(0.3, 0.9);
    layer.moveTo({ x: 0.8, at: 0, gait: 'walk', beats: 'none' });
    let head = 0;
    let body = 0;
    let previousFacing = 1;
    let changedHandedness = false;
    for (let i = 0; i <= 180; i++) {
      if (i === 60) layer.moveTo({ x: 0.2, at: 1, gait: 'walk', beats: 'none' });
      const frame = layer.update(i / 60);
      const worldHead = frame.pose.turnHead * frame.placement.facing;
      const worldBody = frame.pose.turnBody * frame.placement.facing;
      // The 60 ms head spring can move ~0.17 per 60 Hz frame over the full reversal.
      expect(Math.abs(worldHead - head)).toBeLessThan(0.2);
      expect(Math.abs(worldBody - body)).toBeLessThan(0.12);
      expect(Math.abs(frame.placement.facing)).toBe(1);
      if (previousFacing !== frame.placement.facing) changedHandedness = true;
      head = worldHead;
      body = worldBody;
      previousFacing = frame.placement.facing;
    }
    expect(changedHandedness).toBe(true);
  });
});
