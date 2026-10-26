// Authors Tavi's rig additions into the remixed mascot source (art/mascot-remix/scene.rml) as
// text, idempotently: previous additions (marked `tavi:` ids, client 7) are removed first.
//   node tools/mascot-remix/author.mjs && rive art/mascot-remix --once
// Adds (see docs/character/RIG-SPEC.md for names):
//   - runtime names on the nodes/bones the motion layer drives (tavi/body, tavi/armL.fore, ...)
//   - control tracks `tavi/<channel>` keying each joystick axis from -1.25 to 1.25 (no in-memory
//     patch needed for this file)
//   - brow tilt (inner end up/down) via brow vertex keys: tavi/browTiltL, tavi/browTiltR
//   - an opening mouth that morphs from the line: tavi/mouthOpen, tavi/mouthWide
//   - hand poses on each forearm (rest, open, fist, point, thumb): tavi/handL, tavi/handR
//   - arms drawn in front of the hair on demand: tavi/armsFront
//   - in-place gait cycles for the gait system: tavi/gait/walk (42 f), tavi/gait/trudge (80 f)
//   - body-state poses: sit_floor, swing_legs, sleep_breath, zzz
// The original art and animations are not changed. Source: "Mascot / Avatar Customization" by
// alisketch (CC BY 4.0), remixed.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { addTurnaround } from './steps/turn.mjs';

/**
 * Where everything lives in the mascot source (RML component ids) and how the additions look.
 * A character variant built from the same rig passes its own spec (e.g. other skin colours, or
 * ids from its own source) to `authorTavi`; the `tavi/*` names and tracks stay the same, so the
 * manifest, motion and acting are shared. See docs/character/RIG-SPEC.md ("v2 rig contract").
 */
export const lylaSpec = {
  artboard: 'lyla animation',
  colors: { skin: 'FFFFB7BE', skinDark: 'FFF29AA6', mouth: 'FF8E1440', tongue: 'FFFF7F9B' },
  /** component id -> runtime name the motion layer binds. */
  names: {
    '0:2559': 'tavi/footL',
    '0:2506': 'tavi/footR',
    '0:2207': 'tavi/body',
    '0:2206': 'tavi/upper',
    '0:5358': 'tavi/head',
    '0:5038': 'tavi/armL',
    '0:4914': 'tavi/armR',
    '0:2079': 'tavi/armL.upper',
    '0:2080': 'tavi/armL.fore',
    '0:2340': 'tavi/armR.upper',
    '0:2341': 'tavi/armR.fore',
    // Pupil look-at target: the irises follow it (translation constraint) within 8 units of each
    // eye centre (distance constraint). Clips key it; Tavi adds offsets.
    '0:1265': 'tavi/eyes',
  },
  /** Forearm bones (hands attach at `tip` along each) and shoulder groups (draw rules). */
  arms: {
    L: { fore: '0:2080', shoulder: '0:5038' },
    R: { fore: '0:2341', shoulder: '0:4914' },
    tip: 46.9,
    /** Natural draw position (behind this drawable) and the front one (above the bangs). */
    behind: '0:656',
    front: '0:447',
  },
  /** The mouth line; the open mouth sits behind it at `y`. */
  /** The mouth line, its rest geometry, and the timelines that move it. */
  mouth: {
    line: '0:552',
    x: -0.020858049,
    y: 41.940498,
    right: [18.316, -2.3575001],
    middle: [-0.56199998, 2.3575001],
    left: [-18.316, -2.3575001],
    vertices: { right: '0:554', middle: '0:555', left: '0:2703' },
    stroke: 4.3523202,
    lineColor: 'FFEB0066',
    /** Lower-lip drop when fully open (units). */
    depth: 20,
    smileTimeline: 'mouth smile frown',
    positionTimelines: ['mouth X', 'mouth Y'],
  },
  /** Brow path vertices: inner/outer end and their rest y. */
  /** Rest transforms of the parts gait cycles key (absolute values in their parents). */
  gait: {
    footL: { id: '0:2559', x: 288.5, y: 525.5 },
    footR: { id: '0:2506', x: 322.5, y: 525.5 },
    hip: { id: '0:2207', y: -150 },
    torso: { id: '0:2206' },
    neck: { id: '0:5358' },
    armL: { id: '0:5038' },
    armR: { id: '0:4914' },
    /** The head node (Zs float above it). */
    head: { id: '0:437' },
    /** Hip drop for sitting on the floor (measured by the body-states work on v1). */
    seatDrop: 106,
  },
  brows: {
    L: { inner: '0:478', innerY: -4.513, outer: '0:476', outerY: 8.527 },
    R: { inner: '0:484', innerY: -4.513, outer: '0:482', outerY: 8.527 },
  },
  /** Control channel -> joystick [id, axis] pairs keyed from -1.25 to 1.25. */
  joysticks: {
    faceX: [['0:2850', 'x']],
    faceY: [['0:2850', 'y']],
    browLeft: [['0:1591', 'y']],
    browRight: [['0:1593', 'y']],
    blinkLeft: [['0:1909', 'y']],
    blinkRight: [['0:1913', 'y']],
    lidLeft: [['0:1983', 'y']],
    lidRight: [['0:1982', 'y']],
    // Two joysticks drive the same mouth timelines; key both so they agree.
    mouthX: [
      ['0:2647', 'x'],
      ['0:12152', 'x'],
    ],
    mouthY: [
      ['0:2647', 'y'],
      ['0:12152', 'y'],
    ],
    mouthCurve: [['0:2739', 'y']],
    squash: [['0:1442', 'y']],
    hairSwing: [['0:2154', 'x']],
    hairSwoop: [['0:2292', 'x']],
    hairSquash: [['0:6009', 'y']],
  },
};

/** Returns `source` RML with Tavi's additions (previous ones replaced). Pure. */
export function authorTavi(source, spec = lylaSpec) {
  let rml = source;

  // --- 0. Remove previous additions -----------------------------------------------------------
  rml = rml.replace(/\n?[ \t]*<!-- tavi:begin [a-z-]+ -->[\s\S]*?<!-- tavi:end [a-z-]+ -->/g, '');
  rml = rml.replace(/ data-tavi-name="[^"]*"/g, '');

  let next = 1;
  const id = () => `7:${String(next++)}`;
  const SKIN = spec.colors.skin;
  const SKIN_DARK = spec.colors.skinDark;
  const MOUTH = spec.colors.mouth;
  const TONGUE = spec.colors.tongue;

  // --- 1. Runtime names ------------------------------------------------------------------------
  for (const [component, name] of Object.entries(spec.names)) {
    const pattern = new RegExp(`(<[A-Za-z]+ [^>]*?)name="[^"]*"([^>]*? id="${component}")`);
    if (!pattern.test(rml)) throw new Error('component not found: ' + component);
    rml = rml.replace(pattern, `$1name="${name}"$2`);
  }

  // --- helpers ---------------------------------------------------------------------------------
  const kf = (frames, interpolation = 'linear') =>
    frames
      .map(
        ([frame, value]) =>
          `<KeyFrameDouble value="${String(value)}" interpolationType="${interpolation}" frame="${String(frame)}" id="${id()}"/>`,
      )
      .join('');
  const keyed = (objectId, props) =>
    `<KeyedObject objectId="${objectId}" id="${id()}">${Object.entries(props)
      .map(
        ([property, frames]) =>
          `<KeyedProperty property="${property}" id="${id()}">${kf(frames)}</KeyedProperty>`,
      )
      .join('')}</KeyedObject>`;
  const keyedIds = (objectId, property, frames) =>
    `<KeyedObject objectId="${objectId}" id="${id()}"><KeyedProperty property="${property}" id="${id()}">${frames
      .map(
        ([frame, value]) => `<KeyFrameId value="${value}" frame="${String(frame)}" id="${id()}"/>`,
      )
      .join('')}</KeyedProperty></KeyedObject>`;
  const anim = (name, body, duration = 60) =>
    `<LinearAnimation duration="${String(duration)}" name="${name}" id="${id()}">${body}</LinearAnimation>`;
  const fill = (color) =>
    `<Fill name="Fill" id="${id()}"><SolidColor colorValue="${color}" name="Color" id="${id()}"/></Fill>`;
  const ellipse = (name, x, y, w, h, color, rotation = 0) =>
    `<Shape x="${String(x)}" y="${String(y)}" rotation="${String(rotation)}" name="${name}" id="${id()}"><Ellipse width="${String(w)}" height="${String(h)}" name="Path" id="${id()}"/>${fill(color)}</Shape>`;
  const capsule = (name, x, y, w, h, color, rotation = 0) =>
    `<Shape x="${String(x)}" y="${String(y)}" rotation="${String(rotation)}" name="${name}" id="${id()}"><Rectangle width="${String(w)}" height="${String(h)}" cornerRadiusTL="${String(Math.min(w, h) / 2)}" name="Path" id="${id()}"/>${fill(color)}</Shape>`;
  const block = (tag, content) => `<!-- tavi:begin ${tag} -->${content}<!-- tavi:end ${tag} -->`;
  const insertAfterOpen = (componentId, content) => {
    // Self-closing element -> open/close with the content as its first child (drawn on top).
    const selfClosing = new RegExp(`(<([A-Za-z]+) [^>]*? id="${componentId}")/>`);
    if (selfClosing.test(rml)) {
      rml = rml.replace(selfClosing, (_, open, tag) => `${open}>${content}</${tag}>`);
      return;
    }
    const opening = new RegExp(`(<[A-Za-z]+ [^>]*? id="${componentId}">)`);
    if (!opening.test(rml)) throw new Error('component not found: ' + componentId);
    rml = rml.replace(opening, `$1${content}`);
  };
  const insertAfterElement = (componentId, content) => {
    // After the element's closing tag (drawn behind it).
    const start = rml.search(new RegExp(`<[A-Za-z]+ [^>]*? id="${componentId}"`));
    if (start < 0) throw new Error('component not found: ' + componentId);
    const tag = /<([A-Za-z]+)/.exec(rml.slice(start))?.[1];
    const head = rml.indexOf('>', start);
    let end;
    if (rml[head - 1] === '/') end = head + 1;
    else {
      let depth = 0;
      const re = new RegExp(`<(/?)${tag}\\b[^>]*?(/?)>`, 'g');
      re.lastIndex = start;
      for (let m = re.exec(rml); m; m = re.exec(rml)) {
        if (m[2] === '/') continue;
        depth += m[1] ? -1 : 1;
        if (depth === 0) {
          end = m.index + m[0].length;
          break;
        }
      }
    }
    rml = rml.slice(0, end) + content + rml.slice(end);
  };

  // --- 2. Hands on each forearm (bone space: x along the forearm, tip at its length) ------------
  const handSolo = (side) => {
    const ids = { rest: id(), open: id(), fist: id(), point: id(), thumb: id(), solo: id() };
    const tip = spec.arms.tip;
    const pose = (key, name, parts) => `<Node name="${name}" id="${ids[key]}">${parts}</Node>`;
    const content =
      `<Solo activeComponentId="${ids.rest}" x="${String(tip)}" y="0" name="tavi/hand${side}" id="${ids.solo}">` +
      pose('rest', 'rest', '') +
      pose(
        'open',
        'open palm',
        capsule('thumb', 0, -10, 15, 8, SKIN, -0.7) + ellipse('palm', 7, 1, 25, 23, SKIN),
      ) +
      pose(
        'fist',
        'fist',
        ellipse('crease', 6, 4, 9, 3, SKIN_DARK) + ellipse('knuckles', 5, 0, 22, 22, SKIN),
      ) +
      pose(
        'point',
        'point',
        capsule('finger', 15, -2, 20, 8, SKIN) + ellipse('fist', 3, 1, 20, 20, SKIN),
      ) +
      pose(
        'thumb',
        'thumbs up',
        capsule('thumb', 4, -13, 8, 16, SKIN) + ellipse('fist', 4, 1, 20, 20, SKIN),
      ) +
      `</Solo>`;
    return { content, ids };
  };
  const handL = handSolo('L');
  const handR = handSolo('R');
  insertAfterOpen(spec.arms.L.fore, block('hand-l', handL.content));
  insertAfterOpen(spec.arms.R.fore, block('hand-r', handR.content));

  // --- 3. Opening mouth (one mouth at a time) ------------------------------------------------
  // The open mouth is a filled, lip-outlined copy of the mouth line whose lower lip separates as
  // `tavi/mouthOpen` rises: at 0 it is flat and exactly on the line. The line's stroke hands over
  // to it within the first 8% of opening (same geometry, so it reads as one mouth throughout).
  // Its corners and upper lip copy the line's smile/frown keys, and its wrapper copies the line's
  // position keys, so an open smile and an open frown both follow the curve. `tavi/mouthWide`
  // scales the wrapper: -1 round (O/U) .. 0 neutral .. 1 wide (E).
  const m = spec.mouth;
  const mouthIds = {
    wrap: id(),
    shape: id(),
    path: id(),
    right: id(),
    top: id(),
    left: id(),
    bottom: id(),
  };
  const lipStroke = `<Stroke thickness="${String(m.stroke)}" cap="round" join="round" name="lips" id="${id()}"><SolidColor colorValue="${m.lineColor}" name="Color" id="${id()}"/></Stroke>`;
  insertAfterElement(
    m.line,
    block(
      'mouth-open',
      `<Node x="${String(m.x)}" y="${String(m.y)}" name="tavi/mouth" id="${mouthIds.wrap}">` +
        `<Shape opacity="0" name="tavi/mouthInterior" id="${mouthIds.shape}">` +
        `<PointsPath isClosed="true" name="Path" id="${mouthIds.path}">` +
        `<CubicDetachedVertex x="${String(m.right[0])}" y="${String(m.right[1])}" name="R" id="${mouthIds.right}"/>` +
        `<CubicDetachedVertex inDistance="11.687" outRotation="3.1415927" outDistance="11.686" x="${String(m.middle[0])}" y="${String(m.middle[1])}" name="upper lip" id="${mouthIds.top}"/>` +
        `<StraightVertex x="${String(m.left[0])}" y="${String(m.left[1])}" name="L" id="${mouthIds.left}"/>` +
        `<CubicDetachedVertex inRotation="3.1415927" inDistance="11.687" outDistance="11.686" x="${String(m.middle[0])}" y="${String(m.middle[1])}" name="lower lip" id="${mouthIds.bottom}"/>` +
        `</PointsPath>` +
        lipStroke +
        fill(MOUTH) +
        `</Shape></Node>`,
    ),
  );
  /** Copies a timeline's keys on `from` onto `to` (fresh ids), inside that timeline. */
  const mirrorKeys = (timeline, pairs) => {
    const start = rml.search(new RegExp(`<LinearAnimation [^>]*?name="${timeline}"`));
    if (start < 0) throw new Error('timeline not found: ' + timeline);
    const end = rml.indexOf('</LinearAnimation>', start);
    const body = rml.slice(start, end);
    let copies = '';
    for (const [from, to] of pairs) {
      const match = new RegExp(
        `<KeyedObject objectId="${from}"[^>]*>[\\s\\S]*?</KeyedObject>`,
      ).exec(body);
      if (!match) continue;
      copies += match[0]
        .replace(`objectId="${from}"`, `objectId="${to}"`)
        .replace(/ id="[^"]*"/g, () => ` id="${id()}"`);
    }
    if (copies)
      rml =
        rml.slice(0, end) +
        block(`mirror-${timeline.toLowerCase().replace(/[^a-z]+/g, '-')}`, copies) +
        rml.slice(end);
  };
  mirrorKeys(m.smileTimeline, [
    [m.vertices.right, mouthIds.right],
    [m.vertices.middle, mouthIds.top],
    [m.vertices.left, mouthIds.left],
  ]);
  for (const timeline of m.positionTimelines) mirrorKeys(timeline, [[m.line, mouthIds.wrap]]);

  // --- 4. Arms in front of the hair (draw rules on each shoulder group) -------------------------
  const armRules = {};
  for (const [side, shoulder] of [
    ['L', spec.arms.L.shoulder],
    ['R', spec.arms.R.shoulder],
  ]) {
    const rules = id(),
      natural = id(),
      front = id();
    armRules[side] = { rules, natural, front };
    insertAfterOpen(
      shoulder,
      block(
        `arm-rules-${side.toLowerCase()}`,
        `<DrawRules drawTargetId="${natural}" name="tavi/armRules${side}" id="${rules}">` +
          `<DrawTarget drawableId="${spec.arms.behind}" placementValue="after" name="natural" id="${natural}"/>` +
          `<DrawTarget drawableId="${spec.arms.front}" placementValue="before" name="front" id="${front}"/>` +
          `</DrawRules>`,
      ),
    );
  }

  // --- 5. Control tracks -----------------------------------------------------------------------
  const RANGE = 1.25;
  const tracks = [];
  for (const [channel, axes] of Object.entries(spec.joysticks))
    tracks.push(
      anim(
        'tavi/' + channel,
        axes
          .map(([joystick, axis]) =>
            keyed(joystick, {
              [axis]: [
                [0, -RANGE],
                [60, RANGE],
              ],
            }),
          )
          .join(''),
      ),
    );
  // Brow tilt: -1 inner end up (sad, worried) .. +1 inner end down (angry), 10 px each way.
  // brow_left (screen-left): inner vertex 0:478 (x +23.5), outer 0:476; brow_right: inner 0:484.
  const tilt = (inner, innerY, outer, outerY) =>
    keyed(inner, {
      y: [
        [0, innerY - 10],
        [30, innerY],
        [60, innerY + 10],
      ],
    }) +
    keyed(outer, {
      y: [
        [0, outerY + 4],
        [30, outerY],
        [60, outerY - 4],
      ],
    });
  for (const side of ['L', 'R']) {
    const brow = spec.brows[side];
    tracks.push(
      anim('tavi/browTilt' + side, tilt(brow.inner, brow.innerY, brow.outer, brow.outerY)),
    );
  }
  // Open mouth: 0 closed (only the line) .. 1 fully open. Hand-over in the first 8%: the line
  // fades out while the open mouth, still flat on the same curve, fades in.
  tracks.push(
    anim(
      'tavi/mouthOpen',
      keyed(m.line, {
        opacity: [
          [0, 1],
          [5, 0],
          [60, 0],
        ],
      }) +
        keyed(mouthIds.shape, {
          opacity: [
            [0, 0],
            [5, 1],
            [60, 1],
          ],
        }) +
        keyed(mouthIds.bottom, {
          y: [
            [0, m.middle[1]],
            [60, m.middle[1] + m.depth],
          ],
          inDistance: [
            [0, 11.687],
            [60, 14],
          ],
          outDistance: [
            [0, 11.686],
            [60, 14],
          ],
        }),
    ),
  );
  // Mouth width: frame 0 round (O/U), 30 neutral, 60 wide (E).
  tracks.push(
    anim(
      'tavi/mouthWide',
      keyed(mouthIds.wrap, {
        scaleX: [
          [0, 0.55],
          [30, 1],
          [60, 1.25],
        ],
        scaleY: [
          [0, 1.2],
          [30, 1],
          [60, 0.85],
        ],
      }),
    ),
  );
  for (const [side, hand] of [
    ['L', handL],
    ['R', handR],
  ])
    tracks.push(
      anim(
        'tavi/hand' + side,
        keyedIds(hand.ids.solo, 'activeComponentId', [
          [0, hand.ids.rest],
          [10, hand.ids.open],
          [20, hand.ids.fist],
          [30, hand.ids.point],
          [40, hand.ids.thumb],
        ]),
      ),
    );
  tracks.push(
    anim(
      'tavi/armsFront',
      keyedIds(armRules.L.rules, 'drawTargetId', [
        [0, armRules.L.natural],
        [30, armRules.L.front],
      ]) +
        keyedIds(armRules.R.rules, 'drawTargetId', [
          [0, armRules.R.natural],
          [30, armRules.R.front],
        ]),
    ),
  );

  // --- 6. Authored gait cycles (in place; locomotion moves the character) -----------------
  // Names and loop lengths follow motion/systems/gaits/library.ts (authoredGaitClips): one cycle
  // is two steps. Feet are IK targets: the planted foot slides back at ground speed while the
  // other lifts and swings forward; hips bob (low at contact), the torso counter-twists and the
  // arms swing opposite the legs.
  const g = spec.gait;
  const cycle = ({ name, frames, stride, lift, bob, crouch, lean, twist, swing, head }) => {
    const half = frames / 2;
    const foot = (part, plantStart) => {
      // Planted: front -> back over half a cycle; swing: back -> front, lifted at mid-swing.
      const at = (f) => ((f % frames) + frames) % frames;
      const keysX = new Map(),
        keysY = new Map();
      keysX.set(at(plantStart), part.x + stride);
      keysY.set(at(plantStart), part.y);
      keysX.set(at(plantStart + half), part.x - stride);
      keysY.set(at(plantStart + half), part.y);
      keysX.set(at(plantStart + half * 1.5), part.x);
      keysY.set(at(plantStart + half * 1.5), part.y - lift);
      /** Sorted keys over 0..frames, closing the loop (frame 0 interpolated if needed). */
      const close = (map) => {
        const sorted = [...map.entries()].sort((a, b) => a[0] - b[0]);
        const first = sorted[0];
        if (first && first[0] !== 0) {
          // Interpolate the value at frame 0 from the wrap-around segment.
          const last = sorted[sorted.length - 1];
          const span = frames - last[0] + first[0];
          const value = last[1] + ((first[1] - last[1]) * (frames - last[0])) / span;
          sorted.unshift([0, value]);
        }
        sorted.push([frames, sorted[0][1]]);
        return sorted;
      };
      return keyed(part.id, { x: close(keysX), y: close(keysY) });
    };
    const wave = (value, base, offset = 0) => [
      [0, base + value * Math.cos(offset)],
      [half / 2, base + value * Math.cos(offset + Math.PI / 2)],
      [half, base + value * Math.cos(offset + Math.PI)],
      [half * 1.5, base + value * Math.cos(offset + Math.PI * 1.5)],
      [frames, base + value * Math.cos(offset)],
    ];
    const body =
      foot(g.footL, 0) +
      foot(g.footR, half) +
      keyed(g.hip.id, {
        y: [
          [0, g.hip.y + crouch + bob],
          [half / 2, g.hip.y + crouch - bob],
          [half, g.hip.y + crouch + bob],
          [half * 1.5, g.hip.y + crouch - bob],
          [frames, g.hip.y + crouch + bob],
        ],
      }) +
      keyed(g.torso.id, { rotation: wave(twist, lean) }) +
      keyed(g.armL.id, { rotation: wave(swing, 0) }) +
      keyed(g.armR.id, { rotation: wave(swing, 0) }) +
      keyed(g.neck.id, { rotation: wave(twist * 0.5, head, Math.PI) });
    return `<LinearAnimation duration="${String(frames)}" loopValue="loop" name="${name}" id="${id()}">${body}</LinearAnimation>`;
  };
  tracks.push(
    cycle({
      name: 'tavi/gait/walk',
      frames: 42,
      stride: 14,
      lift: 11,
      bob: 3,
      crouch: 0,
      lean: 0.02,
      twist: 0.03,
      swing: 0.12,
      head: 0,
    }),
  );
  tracks.push(
    cycle({
      name: 'tavi/gait/trudge',
      frames: 80,
      stride: 9,
      lift: 3,
      bob: 2,
      crouch: 7,
      lean: 0.08,
      twist: 0.02,
      swing: 0.05,
      head: 0.07,
    }),
  );

  // --- 7. Body-state poses (names from docs/motion/BODY-STATES-RESEARCH.md; bones only) -------
  // sit_floor: one-frame pose, hips dropped onto the seat with the feet drawn in.
  tracks.push(
    anim(
      'sit_floor',
      keyed(g.hip.id, { y: [[0, g.hip.y + g.seatDrop]] }) +
        keyed(g.footL.id, { x: [[0, g.footL.x + 9]], y: [[0, g.footL.y]] }) +
        keyed(g.footR.id, { x: [[0, g.footR.x - 9]], y: [[0, g.footR.y]] }) +
        keyed(g.armL.id, { rotation: [[0, 0.25]] }) +
        keyed(g.armR.id, { rotation: [[0, -0.25]] }),
      1,
    ),
  );
  // swing_legs: 1 s loop, feet alternate forward/up (layer over a ledge sit).
  tracks.push(
    `<LinearAnimation duration="60" loopValue="loop" name="swing_legs" id="${id()}">` +
      keyed(g.footL.id, {
        x: [
          [0, g.footL.x - 6],
          [30, g.footL.x + 6],
          [60, g.footL.x - 6],
        ],
        y: [
          [0, g.footL.y],
          [15, g.footL.y - 9],
          [30, g.footL.y],
          [60, g.footL.y],
        ],
      }) +
      keyed(g.footR.id, {
        x: [
          [0, g.footR.x + 6],
          [30, g.footR.x - 6],
          [60, g.footR.x + 6],
        ],
        y: [
          [0, g.footR.y],
          [30, g.footR.y],
          [45, g.footR.y - 9],
          [60, g.footR.y],
        ],
      }) +
      `</LinearAnimation>`,
  );
  // sleep_breath: 5 s loop, belly then shoulders (2-3% torso scale).
  tracks.push(
    `<LinearAnimation duration="300" loopValue="loop" name="sleep_breath" id="${id()}">` +
      keyed(g.torso.id, {
        scaleY: [
          [0, 1],
          [120, 1.025],
          [300, 1],
        ],
        scaleX: [
          [0, 1],
          [100, 1.012],
          [300, 1],
        ],
      }) +
      keyed(g.neck.id, {
        y: [
          [0, -101.578],
          [140, -102.8],
          [300, -101.578],
        ],
      }) +
      `</LinearAnimation>`,
  );
  // zzz: 2 s loop of three Zs rising and fading above the head (hidden at rest).
  const zIds = [id(), id(), id()];
  const zShape = (zid, x, y, size) =>
    `<Shape x="${String(x)}" y="${String(y)}" opacity="0" name="z" id="${zid}"><PointsPath name="Path" id="${id()}">` +
    `<StraightVertex x="${String(-size / 2)}" y="${String(-size / 2)}" name="a" id="${id()}"/>` +
    `<StraightVertex x="${String(size / 2)}" y="${String(-size / 2)}" name="b" id="${id()}"/>` +
    `<StraightVertex x="${String(-size / 2)}" y="${String(size / 2)}" name="c" id="${id()}"/>` +
    `<StraightVertex x="${String(size / 2)}" y="${String(size / 2)}" name="d" id="${id()}"/>` +
    `</PointsPath><Stroke thickness="4" cap="round" join="round" name="Stroke" id="${id()}"><SolidColor colorValue="FF6F7AD8" name="Color" id="${id()}"/></Stroke></Shape>`;
  const zSpots = [
    [62, -150, 12],
    [80, -175, 16],
    [100, -205, 20],
  ];
  insertAfterOpen(
    g.head.id,
    block(
      'zzz',
      `<Node name="tavi/zzz" id="${id()}">` +
        zIds.map((zid, i) => zShape(zid, ...zSpots[i])).join('') +
        `</Node>`,
    ),
  );
  tracks.push(
    `<LinearAnimation duration="120" loopValue="loop" name="zzz" id="${id()}">` +
      zIds
        .map((zid, i) => {
          const start = i * 25;
          const [x, y] = zSpots[i];
          return keyed(zid, {
            opacity: [
              [0, 0],
              [start, 0],
              [start + 15, 1],
              [start + 60, 0],
              [120, 0],
            ],
            y: [
              [0, y + 20],
              [start, y + 20],
              [start + 60, y - 10],
              [120, y + 20],
            ],
            x: [
              [0, x],
              [start + 30, x + 6],
              [start + 60, x],
              [120, x],
            ],
          });
        })
        .join('') +
      `</LinearAnimation>`,
  );

  // Animations go at the end of the lyla artboard (before its closing tag).
  const board = rml.indexOf(`name="${spec.artboard}"`);
  const close = rml.indexOf('\n    </Artboard>', board);
  rml =
    rml.slice(0, close) +
    '\n        ' +
    block('tracks', tracks.join('\n        ')) +
    rml.slice(close);

  rml = addTurnaround(rml, spec.turn, spec.artboard);
  return { rml, objects: next - 1 };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const file = process.argv[2] ?? 'art/mascot-remix/scene.rml';
  const { rml, objects } = authorTavi(readFileSync(file, 'utf8'));
  writeFileSync(file, rml);
  console.log(`authored ${String(objects)} objects into ${file}`);
}
