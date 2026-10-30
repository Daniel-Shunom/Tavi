import { describe, expect, it } from 'vitest';
import { characters, getCharacter } from '../src/renderer/characters/registry';
import { mascotV2Face } from '../src/renderer/characters/mascot-v2/acting';
import { refinedMotion } from '../src/renderer/characters/tavi-refined/motion';
import {
  walkingKnees,
  requiredItem,
  liftedKnee,
  THIGH,
  SHIN,
  type Point,
} from '../src/renderer/characters/tavi-refined/legs';
import { MotionLayer } from '../src/renderer/motion/motion';
import { neutralPose, type MotionFrame } from '../src/renderer/motion/types';
import { restKey } from '../src/renderer/motion/states/types';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const actingFrame = (): MotionFrame => ({
  time: 0.6,
  pose: neutralPose(),
  clips: [{ role: 'wave', time: 0.6, mix: 0.8 }],
  placement: {
    x: 0.5,
    y: 0.8,
    lean: 0,
    facing: 1,
    scaleX: 1,
    scaleY: 1,
    opacity: 1,
    clipBelow: null,
  },
  shadow: { x: 0.5, y: 0.8, scale: 1, opacity: 1 },
  status: {
    airborne: 0,
    expressions: ['wave'],
    locomotion: 'idle',
    choreography: null,
    fidget: null,
    hidden: false,
  },
});

describe('refined runtime integration', () => {
  it('selects the authored left view rather than mirroring the right cycle', () => {
    const frame = actingFrame();
    frame.placement.facing = -1;
    // The existing controller expresses its turn in mirror-relative space.
    frame.pose.turnBody = 1;
    frame.pose.turnHead = 1;
    frame.status.locomotion = 'moving:walk';
    frame.clips = [{ role: 'gait:walk', time: 0.3, mix: 1 }];
    const result = refinedMotion.bind(frame);
    expect(refinedMotion.screenSpaceViews).toBe(true);
    expect(result.tracks).toContainEqual({ track: 'runtime.gait.walk-left', time: 0.3, mix: 1 });
    expect(result.tracks.find((t) => t.track === 'ctl.turn-body')?.time).toBe(0);
  });
  it('packages the approved directional cycles and six sitting poses without contact drift', () => {
    expect(
      execFileSync('python', ['tools/tavi-rive-lab/check_runtime_foundations.py'], {
        encoding: 'utf8',
        timeout: 15000,
      }),
    ).toContain('12 approved motion/pose foundations verified');
    // The subprocess has its own 15 s budget; the test waits for it.
  }, 20000);
  it.each(['walk', 'run', 'skip'])(
    'uses authored %s on both sides while expressions yield the lower body',
    (id) => {
      for (const direction of [-1, 1]) {
        const frame = actingFrame();
        frame.pose.turnBody = direction;
        frame.status.locomotion = `moving:${id}`;
        frame.pose.bob = 0.1;
        frame.pose.footLY = 0.1;
        frame.clips.push({ role: `gait:${id}`, time: 0.4, mix: 1 });
        const result = refinedMotion.bind(frame);
        const kind = id === 'run' ? 'sprint' : id;
        expect(result.tracks).toContainEqual({
          track: `runtime.gait.${kind}-${direction < 0 ? 'left' : 'right'}`,
          time: 0.4,
          mix: 1,
        });
        expect(result.nodes['runtime-mode']?.x).toBe(6);
        expect(result.nodes['foot-l']).toEqual({ x: 0, y: 0 });
        expect(result.nodes['body']).toEqual({ x: 0, y: 0, scaleX: 1, scaleY: 1 });
        expect(result.tracks.some((t) => t.track.startsWith('runtime.acting.'))).toBe(false);
      }
    },
  );
  it('retains hip and foot acting without giving it ownership during walking or sitting', () => {
    const frame = actingFrame();
    let bound = refinedMotion.bind(frame);
    expect(bound.tracks.find((t) => t.track === 'runtime.acting.wave-once')?.mix).toBe(0.8);
    expect(bound.nodes['runtime-mode']?.x).toBe(5);
    for (const phase of ['anticipate', 'turning', 'moving', 'pausing', 'settling', 'arriving']) {
      frame.status.locomotion = `${phase}:walk`;
      bound = refinedMotion.bind(frame);
      expect(
        bound.tracks.some((t) => t.track.startsWith('runtime.acting.')),
        phase,
      ).toBe(false);
      expect(bound.nodes['runtime-mode']?.x, phase).toBe(0);
    }
    frame.status.locomotion = 'idle';
    bound = refinedMotion.bind(frame, {
      id: 'sit',
      result: {
        key: {
          ...restKey,
          pose: { bob: 126.217996 / 600, footLX: 31.5 / 600, footRX: -30.5 / 600 },
        },
        surfaceY: null,
        height: 0,
        floorShadow: null,
        effects: [],
        ledge: null,
        status: 'hold',
      },
    });
    expect(bound.tracks.some((t) => t.track.startsWith('runtime.acting.'))).toBe(false);
    expect(bound.nodes['runtime-mode']?.x).toBe(6);
  });

  it('exports authored lower-body keys instead of stripping them from the expression port', () => {
    const source = readFileSync('art/tavi-rive-lab/runtime/scene.rml', 'utf8');
    const clips = [
      ...source.matchAll(
        /<LinearAnimation\b[^>]*name="([^"]+)"[^>]*>([\s\S]*?)<\/LinearAnimation>/g,
      ),
    ];
    const wave = clips.find((m) => m[1] === 'tavi/runtime/acting/wave Non Looping')?.[2];
    expect(wave).toBeDefined();
    expect(wave).toContain('objectId="0:2559"');
    expect(wave).toContain('objectId="0:2207"');
    expect(wave).not.toContain('property="scaleY"');
    expect(wave).not.toContain('property="scaleX"');
    expect(source).toContain('name="tavi/runtime/nativeKneeL"');
    expect(source).toContain('name="tavi/runtime/nativeKneeR"');
  });
  it('registers the complete acting library while preserving the old fallback', () => {
    const model = getCharacter('tavi-refined');
    expect(model.id).toBe('tavi-refined');
    expect(model.face).toEqual(mascotV2Face);
    expect(model.nodes['eyes']).toBe('tavi/pupil-offset');
    expect(model.rest[0]?.track).toBe('runtime.rest');
    expect(model.tracks['walk-cycle']).toBe('tavi/runtime/gait/walk-right');
    expect(model.tracks['run-cycle']).toBe('tavi/runtime/gait/sprint-right');
    expect(model.tracks['skip-cycle']).toBe('tavi/runtime/gait/skip-right');
    expect(characters.get('mascot-v2')?.asset).toBe('mascot-v2.riv');
  });

  it.each([-1, 1])('keeps pupil targeting in screen space when facing %i', (direction) => {
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
    const frame = layer.update(0);
    frame.placement.facing = direction;
    frame.pose.gazeX = direction * 0.8;
    frame.pose.pupilX = direction * 0.2;
    frame.pose.armsFront = 1;
    const bound = refinedMotion.bind(frame);
    expect((bound.nodes['eyes']?.x ?? 0) * direction).toBeGreaterThan(0);
    expect(bound.tracks.some((t) => t.track === 'runtime.arms-front')).toBe(true);
    expect(bound.tracks.some((t) => t.track === 'ctl.arms-front')).toBe(false);
    for (const sample of bound.tracks)
      expect(getCharacter('tavi-refined').tracks).toHaveProperty(sample.track);
  });

  it('keeps walking calves parallel without extending either leg', () => {
    for (let phase = 0; phase < Math.PI * 2; phase += 0.03) {
      const hips: Point[] = [
        [-15, 0],
        [15, 0],
      ];
      const feet: Point[] = [
        [-15 + 22 * Math.sin(phase), 125 - Math.max(0, Math.cos(phase)) * 10],
        [15 - 22 * Math.sin(phase), 125 - Math.max(0, -Math.cos(phase)) * 10],
      ];
      const knees = walkingKnees(hips, feet);
      expect(knees).not.toBeNull();
      if (!knees) continue;
      const vectors = feet.map<Point>((f, i) => [
        f[0] - requiredItem(knees, i)[0],
        f[1] - requiredItem(knees, i)[1],
      ]);
      expect(requiredItem(vectors, 0)[0]).toBeCloseTo(requiredItem(vectors, 1)[0], 8);
      expect(requiredItem(vectors, 0)[1]).toBeCloseTo(requiredItem(vectors, 1)[1], 8);
      knees.forEach((k, i) => {
        expect(
          Math.hypot(k[0] - requiredItem(hips, i)[0], k[1] - requiredItem(hips, i)[1]),
        ).toBeLessThanOrEqual(THIGH + 1e-5);
      });
      feet.forEach((f, i) => {
        expect(
          Math.hypot(f[0] - requiredItem(knees, i)[0], f[1] - requiredItem(knees, i)[1]),
        ).toBeCloseTo(SHIN, 7);
      });
    }
  });

  it('tucks lifted knees while preserving the foot target and segment lengths', () => {
    for (let x = -40; x <= 40; x += 5)
      for (let y = 65; y <= 130; y += 5) {
        const k = liftedKnee([0, 0], [x, y]);
        expect(Math.hypot(...k)).toBeLessThanOrEqual(THIGH + 1e-5);
        expect(Math.hypot(x - k[0], y - k[1])).toBeLessThanOrEqual(SHIN + 1e-5);
      }
  });
});
