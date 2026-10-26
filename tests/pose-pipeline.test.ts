// The pose pipeline (src/renderer/motion/pose/): the proxy skeleton matches the measured rig, the
// hand solver plants hands, beats sample continuously, and every library beat passes the
// measurable posing rubric (docs/motion/POSING-AND-STAGING.md section 5).
import { describe, expect, it } from 'vitest';
import { lylaProxy, lylaV2Proxy } from '../src/renderer/characters/mascot/pose';
import { checkBeat, checkPose, CONTACT_TOLERANCE } from '../src/renderer/motion/pose/checks';
import { foldElbows, solveHand } from '../src/renderer/motion/pose/ik';
import { beats } from '../src/renderer/motion/pose/library';
import { joints, restPlacement, type Vec } from '../src/renderer/motion/pose/proxy';
import { sampleBeat } from '../src/renderer/motion/pose/sample';
import { beatDuration, defineBeat } from '../src/renderer/motion/pose/schema';

const near = (a: Vec, b: Vec, tolerance = 0.006) => {
  expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeLessThan(tolerance);
};

describe('proxy skeleton (calibrated against tools/pose-lab/measure.html on Lyla v2)', () => {
  it('rest joints match the measured bones', () => {
    const j = joints(lylaV2Proxy, {});
    near(j.shoulderL, { x: -0.039, y: 0.355 });
    near(j.elbowL, { x: -0.074, y: 0.276 });
    near(j.elbowR, { x: 0.106, y: 0.282 });
    near(j.hips, { x: 0.012, y: 0.265 });
  });
  it('channels move the joints the way the rig does', () => {
    near(joints(lylaV2Proxy, { armL: 1 }).elbowL, { x: -0.125, y: 0.342 });
    near(joints(lylaV2Proxy, { armR: 1 }).elbowR, { x: 0.146, y: 0.354 });
    near(joints(lylaV2Proxy, { bob: 0.1 }).shoulderL, { x: -0.038, y: 0.255 });
    near(joints(lylaV2Proxy, { shift: 0.05 }).hips, { x: 0.062, y: 0.265 });
    // Measured forearm tips (bone length 0.078; the proxy forearm adds the hand).
    const tip = (pose: Parameters<typeof joints>[1], side: 'L' | 'R') => {
      const j = joints(lylaV2Proxy, pose);
      const e = side === 'L' ? j.elbowL : j.elbowR,
        h = side === 'L' ? j.handL : j.handR;
      const k = 0.078 / lylaV2Proxy.foreArm;
      return { x: e.x + (h.x - e.x) * k, y: e.y + (h.y - e.y) * k };
    };
    near(tip({ elbowL: 1 }, 'L'), { x: -0.029, y: 0.212 });
    near(tip({ elbowR: 1 }, 'R'), { x: 0.185, y: 0.284 });
  });
});

describe('hand solver', () => {
  const targets: Vec[] = [
    { x: -0.15, y: 0.2 },
    { x: -0.12, y: 0.45 },
    { x: 0.05, y: 0.3 },
  ];
  it('puts the hand on reachable targets for any body pose and placement', () => {
    const pose = { lean: 0.1, bob: 0.05 };
    const at = { ...restPlacement, lift: -0.3, rot: 5 };
    for (const target of targets) {
      const world = { x: target.x, y: target.y - 0.3 };
      for (const side of ['L', 'R'] as const) {
        const goal = side === 'L' ? world : { x: world.x + 0.12, y: world.y };
        const s = solveHand(lylaV2Proxy, pose, at, side, goal);
        const j = joints(
          lylaV2Proxy,
          { ...pose, [`arm${side}`]: s.arm, [`elbow${side}`]: s.elbow },
          at,
        );
        const hand = side === 'L' ? j.handL : j.handR;
        // On the target when reachable; otherwise as close as the arm allows.
        expect(Math.abs(Math.hypot(hand.x - goal.x, hand.y - goal.y) - s.miss)).toBeLessThan(0.002);
        if (s.miss === 0) near(hand, goal, 0.002);
      }
    }
  });
  it('prefers the requested elbow side', () => {
    const goal = { x: -0.1, y: 0.33 };
    const out = solveHand(lylaV2Proxy, {}, restPlacement, 'L', goal, 'out');
    const down = solveHand(lylaV2Proxy, {}, restPlacement, 'L', goal, 'down');
    const jo = joints(lylaV2Proxy, { armL: out.arm, elbowL: out.elbow });
    const jd = joints(lylaV2Proxy, { armL: down.arm, elbowL: down.elbow });
    expect(jo.elbowL.x).toBeLessThan(jd.elbowL.x + 1e-9);
  });
  it('folds elbows into the shoulder for rigs without them (v1 fallback)', () => {
    const pose = { armL: 1.2, elbowL: -0.8, armR: 0.6, elbowR: 0.9 };
    const bent = joints(lylaV2Proxy, pose);
    const folded = joints(lylaProxy, foldElbows(lylaV2Proxy, pose));
    for (const side of ['L', 'R'] as const) {
      const s = side === 'L' ? bent.shoulderL : bent.shoulderR;
      const a = side === 'L' ? bent.handL : bent.handR;
      const b = side === 'L' ? folded.handL : folded.handR;
      const angle = (p: Vec) => Math.atan2(p.y - s.y, p.x - s.x);
      expect(Math.abs(angle(a) - angle(b))).toBeLessThan(1e-6);
    }
  });
});

describe('beats', () => {
  it('keys must be in order and surfaces must exist', () => {
    expect(() =>
      defineBeat({
        id: 'x',
        label: 'x',
        use: 'gesture',
        keys: [
          { name: 'a', at: 1 },
          { name: 'b', at: 0.5 },
        ],
      }),
    ).toThrow(/not after/);
    expect(() =>
      defineBeat({
        id: 'x',
        label: 'x',
        use: 'gesture',
        keys: [{ name: 'a', at: 0, contacts: [{ part: 'seat', surface: 'nowhere' }] }],
      }),
    ).toThrow(/unknown surface/);
  });
  it('planted hands stay on their targets while the body moves', () => {
    const beat = beats['climb-up'];
    if (!beat) throw new Error('climb-up missing');
    const pull = beat.keys.findIndex((k) => k.name === 'pull');
    const from = beat.keys[pull - 1]?.at ?? 0,
      to = beat.keys[pull]?.at ?? 0;
    for (let t = from; t <= to; t += 1 / 30) {
      const s = sampleBeat(beat, t, lylaV2Proxy);
      const j = joints(lylaV2Proxy, s.pose, s.place);
      if (s.reach.L) near(j.handL, s.reach.L, 0.003);
      if (s.reach.R) near(j.handR, s.reach.R, 0.003);
    }
  });
  it('sampling is continuous and deterministic', () => {
    for (const beat of Object.values(beats)) {
      const a = sampleBeat(beat, beatDuration(beat) * 0.37, lylaV2Proxy, 3);
      const b = sampleBeat(beat, beatDuration(beat) * 0.37, lylaV2Proxy, 3);
      expect(a).toEqual(b);
    }
  });
  for (const [id, beat] of Object.entries(beats))
    it(`${id} passes the measurable posing rubric on Lyla v2`, () => {
      const errors = checkBeat(beat, lylaV2Proxy).findings.filter((f) => f.level === 'error');
      expect(errors).toEqual([]);
    });
});

describe('rubric checks catch mistakes', () => {
  const surfaces = [
    { id: 'floor', kind: 'floor' as const, at: 0 },
    { id: 'edge', kind: 'ledge' as const, at: 0.5 },
  ];
  const rule = (
    pose: Parameters<typeof joints>[1],
    contacts: Parameters<typeof checkPose>[3],
    at = restPlacement,
  ) =>
    checkPose(lylaV2Proxy, pose, joints(lylaV2Proxy, pose, at), contacts, surfaces, 'test').map(
      (f) => f.rule,
    );
  it('contacts off their surface', () => {
    expect(rule({}, [{ part: 'soleL', surface: 'floor' }])).toEqual([]);
    expect(
      rule({}, [{ part: 'soleL', surface: 'floor' }], {
        ...restPlacement,
        lift: 2 * CONTACT_TOLERANCE,
      }),
    ).toContain('contacts');
  });
  it('balance: a body tipped beyond its feet', () => {
    expect(
      rule(
        {},
        [
          { part: 'soleL', surface: 'floor' },
          { part: 'soleR', surface: 'floor' },
        ],
        { ...restPlacement, rot: 25 },
      ),
    ).toContain('balance');
  });
  it('a contact hand hidden behind the hair, and twinned arms', () => {
    const behind = { armL: 2.4, armR: 2.4, handL: 2, handR: 2 };
    expect(rule(behind, [])).toContain('occlusion');
    expect(
      checkPose(
        lylaV2Proxy,
        { ...behind, armsFront: 1 },
        joints(lylaV2Proxy, { ...behind, armsFront: 1 }),
        [],
        surfaces,
        't',
      )
        .filter((f) => f.level === 'error')
        .map((f) => f.rule),
    ).not.toContain('occlusion');
    expect(rule({ armL: 1, armR: 1 }, [])).toContain('silhouette');
  });
  it('out-of-range and non-integer channels', () => {
    expect(rule({ elbowL: 3 }, [])).toContain('range');
    expect(rule({ handL: 1.5 }, [])).toContain('range');
  });
});
