// Rive-authored, landing-only action clips for Tavi. These are real rig timelines: the web page
// may scrub them, but it never substitutes a CSS body pose for the animation.
// Called by author.mjs after the general rig tracks have been written.

const ACTIONS = [
  { name: 'tavi/landing/panic', duration: 120, loop: true },
  { name: 'tavi/landing/relief', duration: 72, loop: false },
  { name: 'tavi/landing/brace', duration: 96, loop: true },
  { name: 'tavi/landing/climb', duration: 144, loop: false },
  { name: 'tavi/landing/sit', duration: 54, loop: false },
  { name: 'tavi/landing/sit-life', duration: 120, loop: true },
  { name: 'tavi/landing/jump-down', duration: 72, loop: false },
  { name: 'tavi/landing/jump-up', duration: 84, loop: false },
];

const round = (value) => Math.round(value * 10000) / 10000;

function tag(source, objectId) {
  const escaped = objectId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = new RegExp(`<([A-Za-z]+)\\b[^>]*\\bid="${escaped}"[^>]*>`).exec(source);
  if (!match) throw new Error('landing actions: component not found: ' + objectId);
  return match[0];
}

function value(source, objectId, property, fallback = 0) {
  const match = new RegExp(`\\b${property}="([^"]*)"`).exec(tag(source, objectId));
  return match ? Number(match[1]) : fallback;
}

/** Add a set of Rive-authored, rig-bound landing actions to the character artboard. */
export function addLandingActions(source, rig) {
  let rml = source.replace(
    /\n?[ \t]*<!-- tavi:begin landing-actions -->[\s\S]*?<!-- tavi:end landing-actions -->/g,
    '',
  );
  let next = 900;
  const id = () => `9:${String(next++)}`;
  const frame = (f, v, interpolation = 'cubic') =>
    `<KeyFrameDouble value="${String(round(v))}" interpolationType="${interpolation}" frame="${String(f)}" id="${id()}"/>`;
  const keyed = (objectId, properties, ease = 'cubic') =>
    `<KeyedObject objectId="${objectId}" id="${id()}">${Object.entries(properties)
      .map(
        ([property, keys]) =>
          `<KeyedProperty property="${property}" id="${id()}">${keys
            .map(([f, v, interpolation]) => frame(f, v, interpolation ?? ease))
            .join('')}</KeyedProperty>`,
      )
      .join('')}</KeyedObject>`;
  const keyedIds = (objectId, property, keys) =>
    `<KeyedObject objectId="${objectId}" id="${id()}"><KeyedProperty property="${property}" id="${id()}">${keys
      .map(
        ([f, v]) =>
          `<KeyFrameId value="${v}" interpolationType="hold" frame="${String(f)}" id="${id()}"/>`,
      )
      .join('')}</KeyedProperty></KeyedObject>`;
  const animation = (name, duration, loop, body) =>
    `<LinearAnimation fps="60" duration="${String(duration)}" loopValue="${loop ? 'loop' : 'oneShot'}" name="${name}" id="${id()}">${body}</LinearAnimation>`;
  const anims = [];
  const push = (name, duration, loop, objects, extra = '') => {
    anims.push(
      animation(
        name,
        duration,
        loop,
        objects.map((o) => keyed(o.id, o.props, o.ease)).join('') + extra,
      ),
    );
  };
  const K = (objectId, properties) => ({ id: objectId, props: properties });

  const body = '0:2207';
  const upper = '0:2206';
  const head = '0:5358';
  const armL = '0:2079';
  const foreL = '0:2080';
  const armR = '0:2340';
  const foreR = '0:2341';
  const legL = '0:2519';
  const kneeL = '0:2520';
  const legR = '0:2494';
  const kneeR = '0:2495';
  const footL = '0:2559';
  const footR = '0:2506';
  const handSoloL = rig.handL.solo;
  const handSoloR = rig.handR.solo;
  const handFistL = rig.handL.fist;
  const handFistR = rig.handR.fist;
  const handOpenL = rig.handL.open;
  const handOpenR = rig.handR.open;

  const b = (objectId) => ({
    x: value(rml, objectId, 'x'),
    y: value(rml, objectId, 'y'),
    rotation: value(rml, objectId, 'rotation'),
    scaleX: value(rml, objectId, 'scaleX', 1),
    scaleY: value(rml, objectId, 'scaleY', 1),
  });
  const base = Object.fromEntries(
    [body, upper, head, armL, foreL, armR, foreR, legL, kneeL, legR, kneeR, footL, footR].map(
      (objectId) => [objectId, b(objectId)],
    ),
  );
  const keys = (property, baseValue, pairs) =>
    pairs.map(([f, delta]) => [f, baseValue + delta, 'cubic']);

  // Frantic, alternating impacts. The cycle resolves to its neutral pose between knocks, so a
  // quick cut to the relief clip does not leave a limb stranded at the end of a hit.
  const panicFrames = [0, 12, 24, 36, 48, 60, 72, 84, 96, 108, 120];
  const pL = [0, 0.35, 1.1, 0.5, 0, 0, 0, 0.35, 1.1, 0.5, 0];
  const pR = [0, 0, 0, 0.35, 1.1, 0.5, 0, 0, 0, 0.35, 1.1];
  push(
    'tavi/landing/panic',
    120,
    true,
    [
      K(body, {
        y: panicFrames.map((f, i) => [f, base[body].y + (i % 2 ? 4 : 0), 'cubic']),
        rotation: panicFrames.map((f, i) => [
          f,
          base[body].rotation + (i % 2 ? -0.025 : 0.025),
          'cubic',
        ]),
      }),
      K(upper, {
        rotation: panicFrames.map((f, i) => [
          f,
          base[upper].rotation + (i % 2 ? 0.13 : -0.06),
          'cubic',
        ]),
      }),
      K(head, {
        rotation: panicFrames.map((f, i) => [
          f,
          base[head].rotation + (i % 2 ? -0.2 : 0.16),
          'cubic',
        ]),
      }),
      K(armL, { rotation: panicFrames.map((f, i) => [f, base[armL].rotation - pL[i], 'cubic']) }),
      K(armR, { rotation: panicFrames.map((f, i) => [f, base[armR].rotation + pR[i], 'cubic']) }),
      K(foreL, {
        rotation: panicFrames.map((f, i) => [f, base[foreL].rotation + pL[i] * 1.2, 'cubic']),
      }),
      K(foreR, {
        rotation: panicFrames.map((f, i) => [f, base[foreR].rotation - pR[i] * 1.2, 'cubic']),
      }),
      K(legL, {
        rotation: panicFrames.map((f, i) => [
          f,
          base[legL].rotation + (i % 2 ? -0.035 : 0),
          'cubic',
        ]),
      }),
      K(legR, {
        rotation: panicFrames.map((f, i) => [
          f,
          base[legR].rotation + (i % 2 ? 0.035 : 0),
          'cubic',
        ]),
      }),
      K(kneeL, {
        rotation: panicFrames.map((f, i) => [
          f,
          base[kneeL].rotation + (i % 2 ? 0.12 : 0),
          'cubic',
        ]),
      }),
      K(kneeR, {
        rotation: panicFrames.map((f, i) => [
          f,
          base[kneeR].rotation - (i % 2 ? 0.12 : 0),
          'cubic',
        ]),
      }),
    ],
    keyedIds(handSoloL, 'activeComponentId', [
      [0, handFistL],
      [120, handFistL],
    ]) +
      keyedIds(handSoloR, 'activeComponentId', [
        [0, handFistR],
        [120, handFistR],
      ]),
  );

  // A held breath, shoulders release first, then the head and hands soften.
  const settle = [0, 8, 20, 36, 54, 72];
  const recovery = [0.82, 0.72, 0.42, 0.16, 0.04, 0];
  push(
    'tavi/landing/relief',
    72,
    false,
    [
      K(body, {
        y: settle.map((f, i) => [f, base[body].y + recovery[i] * 4, 'cubic']),
        scaleX: settle.map((f, i) => [f, base[body].scaleX * (1 + recovery[i] * 0.018), 'cubic']),
        scaleY: settle.map((f, i) => [f, base[body].scaleY * (1 - recovery[i] * 0.028), 'cubic']),
      }),
      K(upper, {
        rotation: settle.map((f, i) => [f, base[upper].rotation - recovery[i] * 0.045, 'cubic']),
      }),
      K(head, {
        rotation: settle.map((f, i) => [f, base[head].rotation + recovery[i] * 0.08, 'cubic']),
      }),
      K(armL, {
        rotation: settle.map((f, i) => [f, base[armL].rotation - recovery[i] * 0.5, 'cubic']),
      }),
      K(armR, {
        rotation: settle.map((f, i) => [f, base[armR].rotation - recovery[i] * 0.5, 'cubic']),
      }),
      K(foreL, {
        rotation: settle.map((f, i) => [f, base[foreL].rotation + recovery[i] * 0.65, 'cubic']),
      }),
      K(foreR, {
        rotation: settle.map((f, i) => [f, base[foreR].rotation - recovery[i] * 0.65, 'cubic']),
      }),
    ],
    keyedIds(handSoloL, 'activeComponentId', [
      [0, handFistL],
      [22, handOpenL],
      [72, handOpenL],
    ]) +
      keyedIds(handSoloR, 'activeComponentId', [
        [0, handFistR],
        [22, handOpenR],
        [72, handOpenR],
      ]),
  );

  // The two open palms land on the screen edge and stay planted. Only a quiet weight shift loops.
  const braceFrames = [0, 16, 32, 48, 64, 80, 96];
  const bracePulse = [0, 0.035, 0, -0.025, 0, 0.025, 0];
  push(
    'tavi/landing/brace',
    96,
    true,
    [
      K(body, {
        y: braceFrames.map((f, i) => [f, base[body].y + 12 + bracePulse[i] * 50, 'cubic']),
      }),
      K(upper, {
        y: braceFrames.map((f, i) => [f, base[upper].y - 3 + bracePulse[i] * 16, 'cubic']),
        rotation: braceFrames.map((f, i) => [
          f,
          base[upper].rotation - 0.08 + bracePulse[i],
          'cubic',
        ]),
      }),
      K(head, {
        rotation: braceFrames.map((f, i) => [
          f,
          base[head].rotation + 0.035 + bracePulse[i],
          'cubic',
        ]),
      }),
      K(armL, { rotation: braceFrames.map((f) => [f, base[armL].rotation - 0.82, 'cubic']) }),
      K(armR, { rotation: braceFrames.map((f) => [f, base[armR].rotation + 0.82, 'cubic']) }),
      K(foreL, { rotation: braceFrames.map((f) => [f, base[foreL].rotation + 0.9, 'cubic']) }),
      K(foreR, { rotation: braceFrames.map((f) => [f, base[foreR].rotation - 0.9, 'cubic']) }),
      K(legL, { rotation: braceFrames.map((f) => [f, base[legL].rotation - 0.035, 'cubic']) }),
      K(legR, { rotation: braceFrames.map((f) => [f, base[legR].rotation + 0.035, 'cubic']) }),
    ],
    keyedIds(handSoloL, 'activeComponentId', [
      [0, handOpenL],
      [96, handOpenL],
    ]) +
      keyedIds(handSoloR, 'activeComponentId', [
        [0, handOpenR],
        [96, handOpenR],
      ]),
  );

  // A clear screen climb with separated contacts: grip, pull, hook a knee, rise, and find balance.
  const climbFrames = [0, 18, 38, 58, 80, 102, 124, 144];
  const lift = [0, -3, -14, -26, -38, -45, -48, -48];
  const elbow = [0, -0.3, -0.55, -0.35, 0.08, 0.25, 0.08, 0];
  push(
    'tavi/landing/climb',
    144,
    false,
    [
      K(body, {
        y: climbFrames.map((f, i) => [f, base[body].y + 14 + lift[i], 'cubic']),
        rotation: climbFrames.map((f, i) => [
          f,
          base[body].rotation + [0.03, 0.05, 0.07, 0.05, 0.015, -0.025, -0.01, 0][i],
          'cubic',
        ]),
      }),
      K(upper, {
        y: climbFrames.map((f, i) => [
          f,
          base[upper].y - [0, 2, 8, 15, 20, 22, 18, 14][i],
          'cubic',
        ]),
        rotation: climbFrames.map((f, i) => [
          f,
          base[upper].rotation + [0.01, -0.08, -0.15, -0.1, 0.06, 0.13, 0.08, 0][i],
          'cubic',
        ]),
      }),
      K(head, {
        rotation: climbFrames.map((f, i) => [
          f,
          base[head].rotation + [0, 0.04, 0.08, 0.04, -0.08, -0.12, -0.04, 0][i],
          'cubic',
        ]),
        y: climbFrames.map((f, i) => [f, base[head].y + lift[i] * 0.25, 'cubic']),
      }),
      K(armL, {
        rotation: climbFrames.map((f, i) => [
          f,
          base[armL].rotation - [0.82, 0.95, 0.95, 0.72, 0.28, 0.02, -0.1, -0.3][i],
          'cubic',
        ]),
      }),
      K(armR, {
        rotation: climbFrames.map((f, i) => [
          f,
          base[armR].rotation + [0.82, 0.7, 0.4, 0.22, 0.15, 0.05, -0.12, -0.3][i],
          'cubic',
        ]),
      }),
      K(foreL, {
        rotation: climbFrames.map((f, i) => [
          f,
          base[foreL].rotation + [0.9, 0.95, 1.05, 0.9, 0.42, 0.15, 0.1, 0.2][i],
          'cubic',
        ]),
      }),
      K(foreR, {
        rotation: climbFrames.map((f, i) => [
          f,
          base[foreR].rotation - [0.9, 0.7, 0.48, 0.25, 0.18, 0.12, 0.2, 0.2][i],
          'cubic',
        ]),
      }),
      K(legL, {
        rotation: climbFrames.map((f, i) => [
          f,
          base[legL].rotation + [0, -0.1, -0.22, -0.4, -0.7, -0.35, -0.15, 0][i],
          'cubic',
        ]),
      }),
      K(kneeL, {
        rotation: climbFrames.map((f, i) => [
          f,
          base[kneeL].rotation + [0, 0.15, 0.28, 0.52, 0.8, 0.44, 0.12, 0][i],
          'cubic',
        ]),
      }),
      K(legR, {
        rotation: climbFrames.map((f, i) => [
          f,
          base[legR].rotation + [0, 0.12, 0.2, 0.2, 0.32, 0.5, 0.25, 0][i],
          'cubic',
        ]),
      }),
      K(kneeR, {
        rotation: climbFrames.map((f, i) => [
          f,
          base[kneeR].rotation - [0, 0.1, 0.22, 0.3, 0.42, 0.6, 0.24, 0][i],
          'cubic',
        ]),
      }),
      K(footL, {
        y: climbFrames.map((f, i) => [
          f,
          base[footL].y + [0, -1, -6, -14, -20, -5, 0, 0][i],
          'cubic',
        ]),
      }),
      K(footR, {
        y: climbFrames.map((f, i) => [f, base[footR].y + [0, 0, 2, 5, 8, -16, -2, 0][i], 'cubic']),
      }),
    ],
    keyedIds(handSoloL, 'activeComponentId', [
      [0, handOpenL],
      [58, handOpenL],
      [80, handFistL],
      [124, handOpenL],
      [144, handOpenL],
    ]) +
      keyedIds(handSoloR, 'activeComponentId', [
        [0, handOpenR],
        [80, handFistR],
        [124, handOpenR],
        [144, handOpenR],
      ]),
  );

  // Land into a seated ledge pose; the existing authored swing_legs clip supplies the living hold.
  const sitFrames = [0, 10, 22, 36, 54];
  push(
    'tavi/landing/sit',
    54,
    false,
    [
      K(body, {
        y: sitFrames.map((f, i) => [f, base[body].y + [0, 20, 45, 62, 68][i], 'cubic']),
        scaleX: sitFrames.map((f, i) => [
          f,
          base[body].scaleX * [1, 1.025, 1.035, 1.01, 1][i],
          'cubic',
        ]),
        scaleY: sitFrames.map((f, i) => [
          f,
          base[body].scaleY * [1, 0.92, 0.9, 0.97, 1][i],
          'cubic',
        ]),
      }),
      K(upper, {
        rotation: sitFrames.map((f, i) => [
          f,
          base[upper].rotation + [0, 0.08, 0.12, 0.05, 0][i],
          'cubic',
        ]),
      }),
      K(head, {
        rotation: sitFrames.map((f, i) => [
          f,
          base[head].rotation + [0, -0.05, -0.1, -0.04, 0][i],
          'cubic',
        ]),
      }),
      K(armL, {
        rotation: sitFrames.map((f, i) => [
          f,
          base[armL].rotation + [0, -0.1, -0.34, -0.3, -0.28][i],
          'cubic',
        ]),
      }),
      K(armR, {
        rotation: sitFrames.map((f, i) => [
          f,
          base[armR].rotation + [0, -0.08, -0.32, -0.28, -0.26][i],
          'cubic',
        ]),
      }),
      K(foreL, {
        rotation: sitFrames.map((f, i) => [
          f,
          base[foreL].rotation + [0, 0.05, 0.22, 0.18, 0.16][i],
          'cubic',
        ]),
      }),
      K(foreR, {
        rotation: sitFrames.map((f, i) => [
          f,
          base[foreR].rotation - [0, 0.05, 0.22, 0.18, 0.16][i],
          'cubic',
        ]),
      }),
      K(legL, {
        rotation: sitFrames.map((f, i) => [
          f,
          base[legL].rotation + [0, -0.16, -0.34, -0.42, -0.44][i],
          'cubic',
        ]),
      }),
      K(kneeL, {
        rotation: sitFrames.map((f, i) => [
          f,
          base[kneeL].rotation + [0, 0.25, 0.52, 0.58, 0.6][i],
          'cubic',
        ]),
      }),
      K(legR, {
        rotation: sitFrames.map((f, i) => [
          f,
          base[legR].rotation + [0, 0.14, 0.3, 0.4, 0.42][i],
          'cubic',
        ]),
      }),
      K(kneeR, {
        rotation: sitFrames.map((f, i) => [
          f,
          base[kneeR].rotation - [0, 0.24, 0.5, 0.58, 0.6][i],
          'cubic',
        ]),
      }),
      K(footL, { y: sitFrames.map((f, i) => [f, base[footL].y + [0, 5, 18, 22, 22][i], 'cubic']) }),
      K(footR, { y: sitFrames.map((f, i) => [f, base[footR].y + [0, 5, 18, 22, 22][i], 'cubic']) }),
    ],
    keyedIds(handSoloL, 'activeComponentId', [
      [0, handOpenL],
      [20, handOpenL],
      [54, handOpenL],
    ]) +
      keyedIds(handSoloR, 'activeComponentId', [
        [0, handOpenR],
        [20, handOpenR],
        [54, handOpenR],
      ]),
  );

  const lifeFrames = [0, 20, 40, 60, 80, 100, 120];
  const life = [0, -2, -4, -2, 0, 2, 0];
  push('tavi/landing/sit-life', 120, true, [
    K(body, { y: lifeFrames.map((f, i) => [f, base[body].y + 68 + life[i], 'cubic']) }),
    K(upper, {
      rotation: lifeFrames.map((f, i) => [
        f,
        base[upper].rotation + 0.08 + life[i] * 0.002,
        'cubic',
      ]),
    }),
    K(head, {
      rotation: lifeFrames.map((f, i) => [
        f,
        base[head].rotation + [0, 0.02, 0, -0.015, 0, 0.02, 0][i],
        'cubic',
      ]),
    }),
    K(legL, { rotation: lifeFrames.map((f) => [f, base[legL].rotation - 0.44, 'cubic']) }),
    K(legR, { rotation: lifeFrames.map((f) => [f, base[legR].rotation + 0.42, 'cubic']) }),
    K(kneeL, { rotation: lifeFrames.map((f) => [f, base[kneeL].rotation + 0.6, 'cubic']) }),
    K(kneeR, { rotation: lifeFrames.map((f) => [f, base[kneeR].rotation - 0.6, 'cubic']) }),
    K(footL, {
      rotation: lifeFrames.map((f, i) => [
        f,
        base[footL].rotation + [0, 0.06, 0.12, 0.06, 0, -0.04, 0][i],
        'cubic',
      ]),
    }),
    K(footR, {
      rotation: lifeFrames.map((f, i) => [
        f,
        base[footR].rotation + [0, -0.05, -0.1, -0.05, 0, 0.03, 0][i],
        'cubic',
      ]),
    }),
  ]);

  const jump = (name, duration, landingY) => {
    const frames = [0, 8, 18, 30, 42, 54, duration];
    const values = landingY
      ? { bodyY: [68, 40, -18, -2, 20, 8, 0], squash: [0, -0.12, 0.05, 0.02, 0.18, 0.08, 0] }
      : {
          bodyY: [0, -22, -76, -106, -92, -44, 68],
          squash: [0, -0.15, 0.02, 0.04, -0.02, 0.12, 0],
        };
    const limb = landingY
      ? { arms: [0.2, 0.38, 0.5, 0.44, 0.2, 0.04, 0], elbow: [-0.15, -0.2, -0.3, -0.2, 0, 0, 0] }
      : { arms: [0, 0.25, 0.5, 0.42, 0.16, 0.08, 0], elbow: [0, -0.15, -0.25, -0.2, -0.08, 0, 0] };
    const by = (objectId, key, delta) =>
      frames.map((f, i) => [f, base[objectId][key] + delta[i], 'cubic']);
    const delta = {
      legL: landingY
        ? [-0.44, -0.38, -0.24, -0.1, -0.04, -0.01, 0]
        : [0, -0.1, -0.28, -0.34, -0.4, -0.44, -0.44],
      legR: landingY
        ? [0.42, 0.36, 0.22, 0.08, 0.03, 0.01, 0]
        : [0, 0.12, 0.3, 0.34, 0.39, 0.42, 0.42],
      kneeL: landingY
        ? [0.6, 0.5, 0.34, 0.2, 0.08, 0.02, 0]
        : [0, 0.18, 0.42, 0.48, 0.54, 0.6, 0.6],
      kneeR: landingY
        ? [-0.6, -0.5, -0.34, -0.2, -0.08, -0.02, 0]
        : [0, -0.2, -0.44, -0.49, -0.55, -0.6, -0.6],
    };
    push(
      name,
      duration,
      false,
      [
        K(body, {
          y: frames.map((f, i) => [f, base[body].y + values.bodyY[i], 'cubic']),
          scaleX: frames.map((f, i) => [
            f,
            base[body].scaleX * (1 + values.squash[i] * 0.55),
            'cubic',
          ]),
          scaleY: frames.map((f, i) => [f, base[body].scaleY * (1 - values.squash[i]), 'cubic']),
        }),
        K(upper, { rotation: by(upper, 'rotation', [0, -0.08, -0.12, 0.04, 0.1, 0.03, 0]) }),
        K(head, { rotation: by(head, 'rotation', [0, 0.04, 0.08, 0, -0.04, 0.01, 0]) }),
        K(armL, {
          rotation: frames.map((f, i) => [f, base[armL].rotation - limb.arms[i], 'cubic']),
        }),
        K(armR, {
          rotation: frames.map((f, i) => [f, base[armR].rotation + limb.arms[i], 'cubic']),
        }),
        K(foreL, {
          rotation: frames.map((f, i) => [f, base[foreL].rotation - limb.elbow[i], 'cubic']),
        }),
        K(foreR, {
          rotation: frames.map((f, i) => [f, base[foreR].rotation + limb.elbow[i], 'cubic']),
        }),
        K(legL, { rotation: by(legL, 'rotation', delta.legL) }),
        K(legR, { rotation: by(legR, 'rotation', delta.legR) }),
        K(kneeL, { rotation: by(kneeL, 'rotation', delta.kneeL) }),
        K(kneeR, { rotation: by(kneeR, 'rotation', delta.kneeR) }),
      ],
      keyedIds(handSoloL, 'activeComponentId', [
        [0, handOpenL],
        [duration, handOpenL],
      ]) +
        keyedIds(handSoloR, 'activeComponentId', [
          [0, handOpenR],
          [duration, handOpenR],
        ]),
    );
  };
  jump('tavi/landing/jump-down', 72, true);
  jump('tavi/landing/jump-up', 84, false);

  // Build after source components so these named Rive animations are ready to bind at runtime.
  const board = rml.indexOf('name="lyla animation"');
  const close = rml.indexOf('\n    </Artboard>', board);
  if (board < 0 || close < 0) throw new Error('landing actions: character artboard not found');
  const block = `<!-- tavi:begin landing-actions -->${anims.join('')}<!-- tavi:end landing-actions -->`;
  rml = rml.slice(0, close) + '\n        ' + block + rml.slice(close);
  return { rml, actions: ACTIONS.map((action) => action.name) };
}
