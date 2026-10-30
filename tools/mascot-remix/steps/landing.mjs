// Rive-authored action clips for the cinematic landing page. Real rig timelines (bones, hands,
// draw order, hair and face joysticks) that the page scrubs or loops; the page never substitutes
// a CSS pose for a performance. Called by author.mjs after the general rig tracks are written.
//
// Authoring rules (docs/motion/POSING-AND-STAGING.md, docs/character/DESIGN-RESEARCH.md):
//   - The legs are IK chains driven by the foot targets. Posed legs (sits, tucks, hanging shins)
//     key the IK strength to 0 and drive the thighs and shins directly; thigh foreshortening is
//     a scaleX on the thigh bone (compensated on the shin).
//   - Every clip keys the complete body set (`BODY`), so a clip hand-off never strands a limb.
//     Channels the motion layer rewrites every frame (`LIVE`: eyes, face, hair, squash) are keyed
//     only by clips that perform with them, so the pointer gaze and hair physics stay alive.
//   - Every keyframe carries an ease curve; `hold` is reserved for ids (hands, draw order).
//   - Contacts are authored in place: the artboard's soles line (y 545) is the surface the page
//     aligns with the scene (cam floor, screen edge, bezel, ledge, floor). Seated poses drop the
//     hips onto that line and hang the legs below it, so the host canvas must leave room there.

/** Clip handles -> authored names, durations (frames at 60 fps) and loop flags. */
export const LANDING_CLIPS = {
  rest: { name: 'tavi/landing/rest', frames: 1, loop: false },
  panic: { name: 'tavi/landing/panic', frames: 72, loop: true },
  relief: { name: 'tavi/landing/relief', frames: 72, loop: false },
  notice: { name: 'tavi/landing/notice', frames: 54, loop: false },
  crouch: { name: 'tavi/landing/crouch', frames: 30, loop: false },
  brace: { name: 'tavi/landing/brace', frames: 96, loop: true },
  'leg-over': { name: 'tavi/landing/leg-over', frames: 90, loop: false },
  drop: { name: 'tavi/landing/drop', frames: 90, loop: false },
  hop: { name: 'tavi/landing/hop', frames: 72, loop: false },
  'sit-down': { name: 'tavi/landing/sit-down', frames: 60, loop: false },
  'sit-life': { name: 'tavi/landing/sit-life', frames: 240, loop: true },
  present: { name: 'tavi/landing/present', frames: 66, loop: false },
};

/** Component ids in the remix the clips key (see author.mjs lylaSpec for the named ones). */
export const landingRig = {
  body: '0:2207',
  upper: '0:2206',
  head: '0:5358',
  armL: '0:2079',
  foreL: '0:2080',
  armR: '0:2340',
  foreR: '0:2341',
  thighL: '0:2519',
  shinL: '0:2520',
  thighR: '0:2494',
  shinR: '0:2495',
  footL: '0:2559',
  footR: '0:2506',
  ikL: '0:2560',
  ikR: '0:2505',
  eyes: '0:1265',
  /** Joysticks: face tilt (x, y), squash (y), hair back swing (x), tassel swing (x), hair squash (y). */
  face: '0:2850',
  squash: '0:1442',
  hairBack: '0:2292',
  hairTassel: '0:2154',
  hairSquash: '0:6009',
};

/** Sign conventions, calibrated on the rig (screen-left arm is a mirrored group). */
const SIGN = {
  // Raise the arm outward/up: positive (the screen-left arm group is a horizontal mirror of the
  // right one, so both take the same raw sense).
  armL: -1,
  armR: -1,
  // Bend the forearm (hand comes up/in): positive.
  foreL: 1,
  foreR: 1,
  // Swing the thigh out to the side (knee away from the midline): positive. Toward the camera is
  // a thigh scaleX (foreshortening), not a rotation.
  thighL: 1,
  thighR: -1,
  // Bend the knee outward (foot away from the midline): positive.
  shinL: 1,
  shinR: -1,
};

const EASE = {
  linear: null,
  inout: [0.65, 0, 0.35, 1],
  out: [0.22, 0.61, 0.36, 1],
  in: [0.55, 0.06, 0.68, 0.19],
  /** Fast start, soft stop: impacts and landings. */
  snap: [0.1, 0.9, 0.2, 1],
  /** Gentle: holds that breathe. */
  soft: [0.4, 0, 0.6, 1],
};

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

/**
 * Pose channels. Numbers are deltas from the rest rig (radians, artboard units) unless noted.
 * `bodyY` positive = hips down; `thighLS` etc. are thigh/shin scaleX multipliers (foreshortening).
 */
const BODY_DEFAULTS = {
  bodyX: 0,
  bodyY: 0,
  bodyRot: 0,
  bodySX: 1,
  bodySY: 1,
  upperY: 0,
  upperRot: 0,
  headY: 0,
  headRot: 0,
  armL: 0,
  armR: 0,
  foreL: 0,
  foreR: 0,
  thighL: 0,
  thighR: 0,
  shinL: 0,
  shinR: 0,
  thighLS: 1,
  thighRS: 1,
  shinLS: 1,
  shinRS: 1,
  footLX: 0,
  footLY: 0,
  footRX: 0,
  footRY: 0,
  /** IK strength on both legs: 1 feet planted (targets), 0 posed legs. */
  ik: 1,
  /** Hand poses: rest, open, fist, point, thumb. */
  handL: 'rest',
  handR: 'rest',
  /** 1 draws the arms in front of the hair. */
  armsFront: 0,
};
/** Channels the motion layer rewrites every frame; keyed only when a clip performs with them. */
const LIVE_DEFAULTS = {
  eyesX: 0,
  eyesY: 0,
  faceX: 0,
  faceY: 0,
  squash: 0,
  hairBack: 0,
  hairTassel: 0,
  hairSquash: 0,
};
const LIVE = Object.keys(LIVE_DEFAULTS);

/** Add a set of Rive-authored, rig-bound landing actions to the character artboard. */
export function addLandingActions(source, rig) {
  let rml = source.replace(
    /\n?[ \t]*<!-- tavi:begin landing-actions -->[\s\S]*?<!-- tavi:end landing-actions -->/g,
    '',
  );
  let next = 900;
  const id = () => `9:${String(next++)}`;
  const R = landingRig;
  const base = (objectId, property, fallback = 0) => value(rml, objectId, property, fallback);
  const b = Object.fromEntries(
    Object.entries({
      body: R.body,
      upper: R.upper,
      head: R.head,
      armL: R.armL,
      armR: R.armR,
      foreL: R.foreL,
      foreR: R.foreR,
      thighL: R.thighL,
      thighR: R.thighR,
      shinL: R.shinL,
      shinR: R.shinR,
      footL: R.footL,
      footR: R.footR,
      eyes: R.eyes,
    }).map(([key, objectId]) => [
      key,
      {
        x: base(objectId, 'x'),
        y: base(objectId, 'y'),
        rotation: base(objectId, 'rotation'),
        scaleX: base(objectId, 'scaleX', 1),
        scaleY: base(objectId, 'scaleY', 1),
      },
    ]),
  );
  const hands = {
    L: {
      rest: rig.handL.rest,
      open: rig.handL.open,
      fist: rig.handL.fist,
      point: rig.handL.point,
      thumb: rig.handL.thumb,
    },
    R: {
      rest: rig.handR.rest,
      open: rig.handR.open,
      fist: rig.handR.fist,
      point: rig.handR.point,
      thumb: rig.handR.thumb,
    },
  };

  /** channel -> [objectId, property, (value) => authored value] (numeric channels). */
  const numeric = {
    bodyX: [R.body, 'x', (v) => b.body.x + v],
    bodyY: [R.body, 'y', (v) => b.body.y + v],
    bodyRot: [R.body, 'rotation', (v) => b.body.rotation + v],
    bodySX: [R.body, 'scaleX', (v) => b.body.scaleX * v],
    bodySY: [R.body, 'scaleY', (v) => b.body.scaleY * v],
    upperY: [R.upper, 'y', (v) => b.upper.y + v],
    upperRot: [R.upper, 'rotation', (v) => b.upper.rotation + v],
    headY: [R.head, 'y', (v) => b.head.y + v],
    headRot: [R.head, 'rotation', (v) => b.head.rotation + v],
    armL: [R.armL, 'rotation', (v) => b.armL.rotation + SIGN.armL * v],
    armR: [R.armR, 'rotation', (v) => b.armR.rotation + SIGN.armR * v],
    foreL: [R.foreL, 'rotation', (v) => b.foreL.rotation + SIGN.foreL * v],
    foreR: [R.foreR, 'rotation', (v) => b.foreR.rotation + SIGN.foreR * v],
    // The stored thigh rotations are stale editor values (IK solves them at runtime); straight
    // down is pi/2 on both legs (calibrated), so posed thighs are keyed from vertical.
    thighL: [R.thighL, 'rotation', (v) => Math.PI / 2 + SIGN.thighL * v],
    thighR: [R.thighR, 'rotation', (v) => Math.PI / 2 + SIGN.thighR * v],
    shinL: [R.shinL, 'rotation', (v) => b.shinL.rotation + SIGN.shinL * v],
    shinR: [R.shinR, 'rotation', (v) => b.shinR.rotation + SIGN.shinR * v],
    thighLS: [R.thighL, 'scaleX', (v) => b.thighL.scaleX * v],
    thighRS: [R.thighR, 'scaleX', (v) => b.thighR.scaleX * v],
    shinLS: [R.shinL, 'scaleX', (v) => b.shinL.scaleX * v],
    shinRS: [R.shinR, 'scaleX', (v) => b.shinR.scaleX * v],
    footLX: [R.footL, 'x', (v) => b.footL.x + v],
    footLY: [R.footL, 'y', (v) => b.footL.y + v],
    footRX: [R.footR, 'x', (v) => b.footR.x + v],
    footRY: [R.footR, 'y', (v) => b.footR.y + v],
    eyesX: [R.eyes, 'x', (v) => b.eyes.x + v],
    eyesY: [R.eyes, 'y', (v) => b.eyes.y + v],
    faceX: [R.face, 'x', (v) => v],
    faceY: [R.face, 'y', (v) => v],
    squash: [R.squash, 'y', (v) => v],
    hairBack: [R.hairBack, 'x', (v) => v],
    hairTassel: [R.hairTassel, 'x', (v) => v],
    hairSquash: [R.hairSquash, 'y', (v) => v],
  };
  /** Channels keyed on several objects or as ids. */
  const special = {
    ik: (v) => [
      [R.ikL, 'strength', v],
      [R.ikR, 'strength', v],
    ],
  };
  const idChannels = {
    handL: (v) => [[rig.handL.solo, 'activeComponentId', hands.L[v]]],
    handR: (v) => [[rig.handR.solo, 'activeComponentId', hands.R[v]]],
    armsFront: (v) => [
      [rig.armRules.L.rules, 'drawTargetId', v ? rig.armRules.L.front : rig.armRules.L.natural],
      [rig.armRules.R.rules, 'drawTargetId', v ? rig.armRules.R.front : rig.armRules.R.natural],
    ],
  };

  const easeTag = (curve) =>
    curve
      ? `<CubicEaseInterpolator x1="${String(curve[0])}" y1="${String(curve[1])}" x2="${String(curve[2])}" y2="${String(curve[3])}" id="${id()}"/>`
      : '';
  const frameTag = (f, v, ease) => {
    const curve = EASE[ease];
    if (curve === undefined) throw new Error('landing actions: unknown ease ' + String(ease));
    return curve
      ? `<KeyFrameDouble value="${String(round(v))}" interpolationType="cubic" frame="${String(f)}" id="${id()}">${easeTag(curve)}</KeyFrameDouble>`
      : `<KeyFrameDouble value="${String(round(v))}" interpolationType="linear" frame="${String(f)}" id="${id()}"/>`;
  };
  const idFrameTag = (f, v) =>
    `<KeyFrameId value="${v}" interpolationType="hold" frame="${String(f)}" id="${id()}"/>`;

  /**
   * Builds one LinearAnimation from keyframes `[{ f, p, e }]`: `p` is a partial pose over the
   * defaults, `e` the ease leaving that key. All BODY channels are keyed at every frame; LIVE
   * channels only if any key sets them.
   */
  const clip = (handle, keys) => {
    const spec = LANDING_CLIPS[handle];
    if (!spec) throw new Error('landing actions: unknown clip ' + handle);
    const used = new Set(keys.flatMap((key) => Object.keys(key.p)));
    for (const channel of used)
      if (!(channel in BODY_DEFAULTS) && !(channel in LIVE_DEFAULTS))
        throw new Error(`landing actions: ${handle} keys unknown channel ${channel}`);
    const channels = [
      ...Object.keys(BODY_DEFAULTS),
      ...LIVE.filter((channel) => used.has(channel)),
    ];
    /** objectId -> property -> frames */
    const objects = new Map();
    const add = (objectId, property, frame) => {
      if (!objects.has(objectId)) objects.set(objectId, new Map());
      const props = objects.get(objectId);
      if (!props.has(property)) props.set(property, []);
      props.get(property).push(frame);
    };
    for (const key of keys) {
      const pose = { ...BODY_DEFAULTS, ...LIVE_DEFAULTS, ...key.p };
      const ease = key.e ?? 'inout';
      for (const channel of channels) {
        const v = pose[channel];
        if (numeric[channel]) {
          const [objectId, property, map] = numeric[channel];
          add(objectId, property, frameTag(key.f, map(v), ease));
        } else if (special[channel]) {
          for (const [objectId, property, mapped] of special[channel](v))
            add(objectId, property, frameTag(key.f, mapped, ease));
        } else if (idChannels[channel]) {
          for (const [objectId, property, mapped] of idChannels[channel](v))
            add(objectId, property, idFrameTag(key.f, mapped));
        }
      }
    }
    const body = [...objects.entries()]
      .map(
        ([objectId, props]) =>
          `<KeyedObject objectId="${objectId}" id="${id()}">${[...props.entries()]
            .map(
              ([property, frames]) =>
                `<KeyedProperty property="${property}" id="${id()}">${frames.join('')}</KeyedProperty>`,
            )
            .join('')}</KeyedObject>`,
      )
      .join('');
    return `<LinearAnimation fps="60" duration="${String(spec.frames)}" loopValue="${spec.loop ? 'loop' : 'oneShot'}" name="${spec.name}" id="${id()}">${body}</LinearAnimation>`;
  };

  // ---------------------------------------------------------------------------------------------
  // Poses (reused across clips so hand-offs match exactly).
  // ---------------------------------------------------------------------------------------------
  const STAND = {};
  /** Seated on an edge: seat on the soles line, thighs toward the camera, shins hanging below. */
  const SEAT = {
    bodyY: 118,
    upperRot: 0.03,
    ik: 0,
    thighL: 0.1,
    thighR: 0.16,
    thighLS: 0.38,
    thighRS: 0.38,
    shinL: -0.08,
    shinR: -0.2,
    shinLS: 1 / 0.38,
    shinRS: 1 / 0.38,
    armL: 0.14,
    armR: 0.1,
    foreL: 0,
    foreR: 0,
    handL: 'open',
    handR: 'open',
  };
  /** Crouched at the edge (knees out, IK), both palms planted on it beside the feet. */
  const BRACE = {
    bodyY: 92,
    upperRot: 0,
    upperY: -2,
    headRot: 0.04,
    armL: 0.06,
    armR: 0.12,
    foreL: 0,
    foreR: 0,
    handL: 'open',
    handR: 'open',
    footLX: -6,
    footRX: 6,
  };
  /** Crouch posed by hand (IK off) so a leg can leave it: knees out, feet back under the hips. */
  const CROUCH_FK = {
    ik: 0,
    thighL: 0.62,
    thighR: 0.62,
    thighLS: 0.78,
    thighRS: 0.78,
    shinL: -1.15,
    shinR: -1.15,
    shinLS: 1 / 0.78,
    shinRS: 1 / 0.78,
  };
  /** In the air: arms thrown up, legs a little apart with the feet flared. */
  const TUCK = {
    ik: 0,
    thighL: 0.14,
    thighR: 0.22,
    thighLS: 0.62,
    thighRS: 0.62,
    shinL: 0.22,
    shinR: 0.34,
    shinLS: 1 / 0.62,
    shinRS: 1 / 0.62,
    armL: 1.3,
    armR: 1.42,
    foreL: 0.3,
    foreR: 0.24,
    handL: 'open',
    handR: 'open',
    armsFront: 1,
  };
  /** Landing: squashed, knees bent (IK on, feet planted), arms out for balance. */
  const LAND = {
    bodyY: 48,
    bodySX: 1.06,
    bodySY: 0.94,
    armL: 0.85,
    armR: 0.95,
    foreL: 0.1,
    foreR: 0.05,
    handL: 'open',
    handR: 'open',
    footLX: -5,
    footRX: 5,
  };

  const anims = [];
  const K = (f, p, e) => ({ f, p, e });

  // A neutral frame: the page applies it first every frame so no clip hand-off leaves state.
  anims.push(clip('rest', [K(0, STAND, 'linear')]));

  // Panic: pounding the glass with alternating fists, hips bouncing, head shaking. Resolves on
  // the rest frame at the loop seam so a cut to relief never strands a limb.
  // Fists up beside the cheeks (as high as this rig's arms go), jabbing at the glass in turn, the
  // whole body lunging into each hit; the head shakes against the lunge.
  const raised = {
    armL: 1.25,
    armR: 1.3,
    foreL: 1.4,
    foreR: 1.35,
    handL: 'fist',
    handR: 'fist',
    armsFront: 1,
    faceY: -0.3,
    hairSquash: -0.2,
  };
  const hit = (side) => ({
    ...raised,
    [side === 'L' ? 'armL' : 'armR']: 1.0,
    [side === 'L' ? 'foreL' : 'foreR']: 0.95,
    bodyY: 7,
    bodySX: 1.03,
    bodySY: 0.97,
    upperRot: side === 'L' ? 0.07 : -0.07,
    headRot: side === 'L' ? -0.16 : 0.16,
    bodyX: side === 'L' ? -5 : 5,
    squash: 0.4,
    hairSquash: 0.5,
    hairBack: side === 'L' ? 0.5 : -0.5,
    hairTassel: side === 'L' ? -0.5 : 0.5,
    faceY: -0.1,
  });
  const wind = (side) => ({
    ...raised,
    bodyY: -3,
    bodySX: 0.99,
    bodySY: 1.02,
    headRot: side === 'L' ? 0.06 : -0.06,
    hairSquash: -0.4,
    squash: -0.25,
  });
  anims.push(
    clip('panic', [
      K(0, wind('L'), 'in'),
      K(6, hit('L'), 'out'),
      K(18, wind('R'), 'in'),
      K(24, hit('R'), 'out'),
      K(36, wind('L'), 'in'),
      K(42, hit('L'), 'out'),
      K(52, wind('R'), 'in'),
      // A double-fisted thump, then the loop seam.
      K(
        58,
        {
          ...hit('R'),
          armL: 1.15,
          foreL: 0.7,
          upperRot: 0,
          headRot: 0,
          bodyX: 0,
          bodyY: 10,
          squash: 0.6,
        },
        'out',
      ),
      K(72, wind('L'), 'in'),
    ]),
  );

  // Relief: fists fall, a held breath leaves (shoulders drop first), hair settles.
  anims.push(
    clip('relief', [
      K(0, { ...raised, bodyY: 0 }, 'out'),
      K(
        10,
        {
          armL: 0.9,
          armR: 0.95,
          foreL: 0.7,
          foreR: 0.7,
          handL: 'open',
          handR: 'open',
          armsFront: 1,
          bodyY: 4,
          bodySY: 0.98,
          bodySX: 1.015,
          faceY: -0.1,
          hairSquash: 0.2,
        },
        'inout',
      ),
      K(
        30,
        {
          armL: 0.2,
          armR: 0.25,
          foreL: 0.1,
          foreR: 0.1,
          handL: 'open',
          handR: 'open',
          bodyY: 8,
          bodySY: 0.975,
          bodySX: 1.02,
          headRot: 0.06,
          upperRot: 0.03,
          squash: 0.25,
          hairSquash: 0.3,
        },
        'soft',
      ),
      K(54, { armL: 0.05, armR: 0.08, bodyY: 2, headRot: -0.02, squash: -0.08 }, 'soft'),
      K(72, STAND, 'soft'),
    ]),
  );

  // Notice: a startled little hop, open palms out, hair lifts, then she looks straight at you.
  anims.push(
    clip('notice', [
      K(0, STAND, 'in'),
      K(6, { bodyY: 14, bodySY: 0.95, bodySX: 1.04, squash: 0.5, armL: 0.15, armR: 0.2 }, 'out'),
      K(
        14,
        {
          bodyY: -26,
          bodySY: 1.06,
          bodySX: 0.97,
          squash: -0.6,
          armL: 1.05,
          armR: 1.15,
          foreL: 0.35,
          foreR: 0.3,
          handL: 'open',
          handR: 'open',
          armsFront: 1,
          hairSquash: -0.7,
          hairBack: 0.2,
          footLY: -14,
          footRY: -16,
          headRot: 0.06,
          faceY: -0.2,
        },
        'in',
      ),
      K(
        24,
        {
          bodyY: 10,
          bodySY: 0.95,
          bodySX: 1.05,
          squash: 0.45,
          armL: 0.75,
          armR: 0.8,
          foreL: 0.25,
          foreR: 0.2,
          handL: 'open',
          handR: 'open',
          armsFront: 1,
          hairSquash: 0.5,
          headRot: -0.03,
        },
        'out',
      ),
      K(
        36,
        {
          bodyY: 0,
          armL: 0.6,
          armR: 0.66,
          foreL: 0.2,
          foreR: 0.15,
          handL: 'open',
          handR: 'open',
          armsFront: 1,
          hairSquash: 0,
        },
        'soft',
      ),
      K(
        54,
        {
          armL: 0.45,
          armR: 0.5,
          foreL: 0.15,
          foreR: 0.1,
          handL: 'open',
          handR: 'open',
          armsFront: 1,
        },
        'soft',
      ),
    ]),
  );

  // Crouch: from the end of `notice` (palms out) down onto the edge, hands landing one after the
  // other (never twinned), eyes going to the edge.
  const noticeEnd = {
    armL: 0.45,
    armR: 0.5,
    foreL: 0.15,
    foreR: 0.1,
    handL: 'open',
    handR: 'open',
    armsFront: 1,
  };
  anims.push(
    clip('crouch', [
      K(0, noticeEnd, 'in'),
      K(
        10,
        {
          ...noticeEnd,
          bodyY: 30,
          bodySX: 1.02,
          bodySY: 0.98,
          armL: 0.3,
          armR: 0.42,
          foreL: 0.05,
          foreR: 0.1,
          headRot: 0.03,
          faceY: 0.2,
          eyesY: 2,
          squash: 0.2,
        },
        'inout',
      ),
      K(
        20,
        {
          ...BRACE,
          bodyY: 98,
          bodySX: 1.04,
          bodySY: 0.96,
          armR: 0.3,
          foreR: 0.15,
          faceY: 0.35,
          eyesY: 4,
          squash: 0.45,
          hairSquash: 0.4,
        },
        'out',
      ),
      K(30, { ...BRACE, faceY: 0.35, eyesY: 4, hairSquash: 0 }, 'soft'),
    ]),
  );

  // Brace: crouched at the screen edge, palms planted on it; a quiet weight shift and a look down.
  const shift = (dx, dy) => ({
    ...BRACE,
    bodyX: dx,
    bodyY: BRACE.bodyY + dy,
    upperRot: dx * 0.004,
    headRot: -dx * 0.006,
  });
  anims.push(
    clip('brace', [
      K(0, { ...shift(0, 0), faceY: 0.35, eyesY: 4 }, 'soft'),
      K(24, { ...shift(4, 2), faceY: 0.4, eyesY: 5 }, 'soft'),
      K(48, { ...shift(0, 0), faceY: 0.3, eyesY: 3, headRot: 0.08 }, 'soft'),
      K(72, { ...shift(-4, 2), faceY: 0.4, eyesY: 5 }, 'soft'),
      K(96, { ...shift(0, 0), faceY: 0.35, eyesY: 4 }, 'soft'),
    ]),
  );

  // Leg over: from the brace, one leg swings out over the edge, then the other; the hips land on
  // the edge and the shins hang below it. Scrubbed by scroll on the page.
  anims.push(
    clip('leg-over', [
      K(0, { ...BRACE, faceY: 0.35 }, 'inout'),
      // Weight onto the left side; the right knee starts to come forward over the edge.
      K(
        18,
        {
          ...BRACE,
          ...CROUCH_FK,
          bodyY: 100,
          bodyX: -6,
          bodyRot: -0.03,
          thighR: 0.4,
          thighRS: 0.55,
          shinR: -0.7,
          shinRS: 1 / 0.55,
          armL: 0.1,
          armR: 0.3,
          foreR: 0.1,
          faceY: 0.4,
          eyesY: 4,
          hairBack: -0.15,
        },
        'inout',
      ),
      // Right shin drops over the edge; the hips slide onto it.
      K(
        40,
        {
          ...SEAT,
          bodyY: 110,
          bodyX: -9,
          bodyRot: -0.04,
          thighR: 0.22,
          thighRS: 0.42,
          shinR: -0.1,
          shinRS: 1 / 0.42,
          thighL: CROUCH_FK.thighL,
          thighLS: CROUCH_FK.thighLS,
          shinL: CROUCH_FK.shinL,
          shinLS: CROUCH_FK.shinLS,
          armL: 0.2,
          armR: 0.3,
          faceY: 0.4,
          eyesY: 4,
          hairBack: -0.3,
          hairTassel: -0.2,
        },
        'inout',
      ),
      // Left leg follows; the hips land on the edge with a small give.
      K(
        62,
        {
          ...SEAT,
          bodyY: 124,
          bodyX: -2,
          bodyRot: 0.02,
          bodySX: 1.02,
          bodySY: 0.98,
          shinL: 0.1,
          shinR: -0.35,
          faceY: 0.3,
          eyesY: 3,
          hairBack: 0.1,
          squash: 0.2,
        },
        'out',
      ),
      K(
        76,
        { ...SEAT, bodyY: 115, shinL: -0.2, shinR: -0.1, faceY: 0.3, eyesY: 2, squash: -0.05 },
        'soft',
      ),
      K(90, { ...SEAT, faceY: 0.25, eyesY: 2 }, 'soft'),
    ]),
  );

  // Drop: seated on an edge, hands press, a push off, the fall (arms up, legs down), a squash
  // landing and a settle to standing. The page moves the body along the fall; this stays in place.
  anims.push(
    clip('drop', [
      K(0, { ...SEAT, faceY: 0.3, eyesY: 3 }, 'inout'),
      K(
        12,
        {
          ...SEAT,
          bodyY: 104,
          upperRot: -0.04,
          armL: 0.42,
          armR: 0.36,
          foreL: 0.05,
          foreR: 0.05,
          faceY: 0.45,
          eyesY: 5,
          hairSquash: 0.2,
        },
        'in',
      ),
      K(
        26,
        {
          ...TUCK,
          bodyY: 60,
          thighL: 0.5,
          thighR: 0.55,
          shinL: 0.4,
          shinR: 0.45,
          armL: 1.1,
          armR: 1.2,
          faceY: 0.2,
          hairSquash: -0.6,
          hairBack: 0.35,
          hairTassel: 0.4,
          squash: -0.5,
        },
        'inout',
      ),
      K(
        44,
        {
          ...TUCK,
          bodyY: 10,
          thighL: 0.35,
          thighR: 0.4,
          shinL: 0.15,
          shinR: 0.2,
          armL: 1.3,
          armR: 1.4,
          faceY: 0.55,
          eyesY: 5,
          hairSquash: -0.8,
          hairBack: 0.5,
          hairTassel: 0.6,
          squash: -0.6,
        },
        'in',
      ),
      K(
        56,
        {
          ...TUCK,
          bodyY: -4,
          thighL: 0.1,
          thighR: 0.12,
          shinL: 0.05,
          shinR: 0.05,
          thighLS: 0.95,
          thighRS: 0.95,
          shinLS: 1 / 0.95,
          shinRS: 1 / 0.95,
          armL: 1.2,
          armR: 1.3,
          faceY: 0.5,
          hairSquash: -0.8,
          hairBack: 0.5,
          hairTassel: 0.6,
          squash: -0.4,
        },
        'snap',
      ),
      K(
        62,
        { ...LAND, faceY: 0.2, hairSquash: 0.7, hairBack: -0.3, hairTassel: -0.4, squash: 0.85 },
        'out',
      ),
      K(
        74,
        {
          ...LAND,
          bodyY: 10,
          bodySX: 1.01,
          bodySY: 0.99,
          armL: 0.5,
          armR: 0.55,
          squash: 0.15,
          hairSquash: 0.1,
          faceY: 0,
        },
        'soft',
      ),
      K(90, { ...STAND, armL: 0.08, armR: 0.1 }, 'soft'),
    ]),
  );

  // Hop: standing to standing. Anticipation crouch, spring, tuck in the air, squash landing.
  anims.push(
    clip('hop', [
      K(0, STAND, 'in'),
      K(
        12,
        {
          bodyY: 44,
          bodySX: 1.05,
          bodySY: 0.95,
          armL: -0.1,
          armR: -0.1,
          foreL: 0.2,
          foreR: 0.2,
          upperRot: 0.02,
          headRot: 0.03,
          squash: 0.6,
          hairSquash: 0.4,
          faceY: -0.2,
          footLX: -4,
          footRX: 4,
        },
        'in',
      ),
      K(
        20,
        {
          bodyY: -16,
          bodySX: 0.96,
          bodySY: 1.07,
          armL: 1.2,
          armR: 1.3,
          foreL: 0.2,
          foreR: 0.15,
          handL: 'open',
          handR: 'open',
          armsFront: 1,
          ik: 0,
          thighL: 0.2,
          thighR: 0.25,
          shinL: 0.3,
          shinR: 0.35,
          squash: -0.7,
          hairSquash: -0.8,
          hairBack: 0.3,
          hairTassel: 0.3,
          faceY: -0.3,
        },
        'out',
      ),
      K(
        36,
        {
          ...TUCK,
          bodyY: -8,
          bodySX: 0.98,
          bodySY: 1.03,
          squash: -0.4,
          hairSquash: -0.6,
          hairBack: 0.35,
          hairTassel: 0.4,
          faceY: -0.1,
        },
        'inout',
      ),
      K(
        50,
        {
          ...TUCK,
          bodyY: 0,
          thighL: 0.25,
          thighR: 0.3,
          shinL: 0.15,
          shinR: 0.2,
          thighLS: 0.92,
          thighRS: 0.92,
          shinLS: 1 / 0.92,
          shinRS: 1 / 0.92,
          armL: 1.1,
          armR: 1.2,
          squash: -0.2,
          hairSquash: -0.5,
          hairBack: 0.4,
          hairTassel: 0.5,
          faceY: 0.35,
          eyesY: 4,
        },
        'snap',
      ),
      K(
        56,
        { ...LAND, squash: 0.85, hairSquash: 0.7, hairBack: -0.3, hairTassel: -0.4, faceY: 0.15 },
        'out',
      ),
      K(
        66,
        {
          bodyY: 8,
          bodySX: 1.01,
          bodySY: 0.99,
          armL: 0.4,
          armR: 0.45,
          foreL: 0.1,
          foreR: 0.1,
          handL: 'open',
          handR: 'open',
          squash: 0.12,
          hairSquash: 0.1,
        },
        'soft',
      ),
      K(72, { ...STAND, armL: 0.06, armR: 0.08 }, 'soft'),
    ]),
  );

  // Sit down: standing on the ledge, a crouch, then the legs swing over the front edge as the hips
  // land on it; a small bounce and the hands come to the ledge.
  anims.push(
    clip('sit-down', [
      K(0, STAND, 'in'),
      K(
        12,
        {
          bodyY: 40,
          bodySX: 1.03,
          bodySY: 0.97,
          upperRot: 0.03,
          armL: 0.2,
          armR: 0.25,
          foreL: 0.15,
          foreR: 0.1,
          handL: 'open',
          handR: 'open',
          faceY: 0.3,
          eyesY: 3,
          squash: 0.3,
        },
        'inout',
      ),
      K(
        30,
        {
          ...SEAT,
          bodyY: 96,
          bodyRot: -0.03,
          thighL: 0.5,
          thighLS: 0.6,
          shinLS: 1 / 0.6,
          shinL: -0.8,
          armL: 0.5,
          armR: 0.45,
          foreL: 0.08,
          foreR: 0.08,
          faceY: 0.3,
          eyesY: 3,
          hairBack: -0.25,
          hairTassel: -0.2,
        },
        'inout',
      ),
      K(
        44,
        {
          ...SEAT,
          bodyY: 126,
          bodySX: 1.03,
          bodySY: 0.97,
          shinL: 0.15,
          shinR: -0.4,
          squash: 0.35,
          hairSquash: 0.4,
          faceY: 0.15,
          eyesY: 2,
        },
        'out',
      ),
      K(
        54,
        { ...SEAT, bodyY: 114, shinL: -0.25, shinR: -0.05, squash: -0.05, hairSquash: -0.1 },
        'soft',
      ),
      K(60, { ...SEAT }, 'soft'),
    ]),
  );

  // Sit life: a 4 s moving hold on the ledge. Shins swing against each other, the torso breathes,
  // the head tilts once; hands stay planted. Eyes and face stay with the motion layer (pointer).
  const life = (f, swing, breath, tilt) =>
    K(
      f,
      {
        ...SEAT,
        shinL: SEAT.shinL + swing,
        shinR: SEAT.shinR - swing * 0.85,
        bodyY: SEAT.bodyY + breath,
        upperRot: SEAT.upperRot + tilt * 0.3,
        headRot: tilt,
        hairBack: swing * 0.3,
        hairTassel: -swing * 0.35,
      },
      'soft',
    );
  anims.push(
    clip('sit-life', [
      life(0, 0, 0, 0),
      life(40, 0.28, -2, 0.02),
      life(80, 0, 0, 0.05),
      life(120, -0.26, -2, 0.03),
      life(160, 0, 0, -0.03),
      life(200, 0.22, -1.5, -0.05),
      life(240, 0, 0, 0),
    ]),
  );

  // Present: shows the thing beside her (screen right): the near arm sweeps out to an open palm
  // and the far hand rests on the hip; a hip shift and a head tilt toward the thing.
  anims.push(
    clip('present', [
      K(0, STAND, 'inout'),
      K(
        14,
        {
          armR: 0.6,
          foreR: 0.55,
          handR: 'open',
          armL: 0.4,
          foreL: 0.9,
          handL: 'fist',
          bodyX: -3,
          upperRot: -0.03,
          headRot: -0.04,
          squash: 0.2,
          faceX: 0.5,
          eyesX: 4,
        },
        'out',
      ),
      K(
        30,
        {
          armR: 1.05,
          foreR: 0.15,
          handR: 'open',
          armL: 0.5,
          foreL: 1.3,
          handL: 'fist',
          bodyX: -5,
          bodyRot: 0.015,
          upperRot: -0.05,
          headRot: -0.09,
          bodySX: 1.01,
          hairBack: 0.2,
          faceX: 0.7,
          eyesX: 6,
          armsFront: 1,
        },
        'soft',
      ),
      K(
        50,
        {
          armR: 1.0,
          foreR: 0.2,
          handR: 'open',
          armL: 0.5,
          foreL: 1.3,
          handL: 'fist',
          bodyX: -5,
          bodyRot: 0.015,
          upperRot: -0.05,
          headRot: -0.07,
          bodySX: 1.01,
          hairBack: 0.1,
          faceX: 0.65,
          eyesX: 6,
          armsFront: 1,
        },
        'soft',
      ),
      K(
        66,
        {
          armR: 1.0,
          foreR: 0.2,
          handR: 'open',
          armL: 0.5,
          foreL: 1.3,
          handL: 'fist',
          bodyX: -5,
          bodyRot: 0.015,
          upperRot: -0.05,
          headRot: -0.08,
          bodySX: 1.01,
          faceX: 0.65,
          eyesX: 6,
          armsFront: 1,
        },
        'soft',
      ),
    ]),
  );

  // Calibration poses (one frame each) used by tools/mascot-remix/landing-sheet.mjs to check the
  // sign conventions above; harmless at runtime (never bound by the manifest).
  if (process.env.TAVI_LANDING_CALIBRATE) {
    const cal = (name, pose) =>
      `<LinearAnimation fps="60" duration="1" loopValue="oneShot" name="tavi/cal/${name}" id="${id()}">${clip(
        'rest',
        [K(0, pose, 'linear')],
      )
        .replace(/^<LinearAnimation[^>]*>/, '')
        .replace(/<\/LinearAnimation>$/, '')}</LinearAnimation>`;
    const rawThigh = (side, angle) => (angle - b['thigh' + side].rotation) / SIGN['thigh' + side];
    for (const [name, pose] of Object.entries({
      'fk-rest': { ik: 0 },
      'fkL-a': { ik: 0, thighL: rawThigh('L', Math.PI / 2) },
      'fkL-b': { ik: 0, thighL: rawThigh('L', -Math.PI / 2) },
      'fkR-a': { ik: 0, thighR: rawThigh('R', Math.PI / 2) },
      'fkR-b': { ik: 0, thighR: rawThigh('R', -Math.PI / 2) },
      armL: { armL: 0.8 },
      armR: { armR: 0.8 },
      foreL: { armL: 0.8, foreL: 0.8 },
      foreR: { armR: 0.8, foreR: 0.8 },
      thighL: { ik: 0, thighL: 0.7 },
      thighR: { ik: 0, thighR: 0.7 },
      shinL: { ik: 0, shinL: 0.7 },
      shinR: { ik: 0, shinR: 0.7 },
      thighS: { ik: 0, thighLS: 0.4, thighRS: 0.4, shinLS: 2.5, shinRS: 2.5 },
      seat: SEAT,
      brace: BRACE,
      tuck: TUCK,
      land: LAND,
      face: { faceX: 0.8, faceY: 0.6, eyesX: 6, eyesY: 5 },
      hair: { hairBack: 0.8, hairTassel: 0.8, hairSquash: 0.8, squash: 0.8 },
    }))
      anims.push(cal(name, pose));
  }

  // Build after source components so these named Rive animations are ready to bind at runtime.
  const board = rml.indexOf('name="lyla animation"');
  const close = rml.indexOf('\n    </Artboard>', board);
  if (board < 0 || close < 0) throw new Error('landing actions: character artboard not found');
  const block = `<!-- tavi:begin landing-actions -->${anims.join('')}<!-- tavi:end landing-actions -->`;
  rml = rml.slice(0, close) + '\n        ' + block + rml.slice(close);
  return { rml, actions: Object.values(LANDING_CLIPS).map((action) => action.name) };
}
