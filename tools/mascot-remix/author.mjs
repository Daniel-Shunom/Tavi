// Authors Tavi's rig additions into the remixed mascot source (art/mascot-remix/scene.rml) as
// text, idempotently: previous additions (marked `tavi:` ids, client 7) are removed first.
//   node tools/mascot-remix/author.mjs && rive art/mascot-remix --once
// Adds (see docs/character/RIG-SPEC.md for names):
//   - runtime names on the nodes/bones the motion layer drives (tavi/body, tavi/armL.fore, ...)
//   - control tracks `tavi/<channel>` keying each joystick axis from -1.25 to 1.25 (no in-memory
//     patch needed for this file)
//   - brow tilt (inner end up/down) via brow vertex keys: tavi/browTiltL, tavi/browTiltR
//   - an open mouth with viseme shapes: tavi/mouthOpen, tavi/viseme
//   - hand poses on each forearm (rest, open, fist, point, thumb): tavi/handL, tavi/handR
//   - arms drawn in front of the hair on demand: tavi/armsFront
// The original art and animations are not changed. Source: "Mascot / Avatar Customization" by
// alisketch (CC BY 4.0), remixed.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

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
  mouth: { line: '0:552', y: 47 },
  /** Brow path vertices: inner/outer end and their rest y. */
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

  // --- 3. Open mouth with visemes (behind the mouth line) ---------------------------------------
  const mouthIds = { group: id(), solo: id(), a: id(), o: id(), e: id(), u: id() };
  const viseme = (key, name, parts) => `<Node name="${name}" id="${mouthIds[key]}">${parts}</Node>`;
  insertAfterElement(
    spec.mouth.line,
    block(
      'mouth-open',
      `<Node x="0" y="${String(spec.mouth.y)}" scaleX="0.6" scaleY="0" name="tavi/mouthOpen" id="${mouthIds.group}">` +
        `<Solo activeComponentId="${mouthIds.a}" name="tavi/visemes" id="${mouthIds.solo}">` +
        viseme(
          'a',
          'A',
          ellipse('tongue', 0, 5, 14, 7, TONGUE) + ellipse('open', 0, 0, 30, 20, MOUTH),
        ) +
        viseme('o', 'O', ellipse('open', 0, 1, 16, 19, MOUTH)) +
        viseme('e', 'E', capsule('open', 0, -1, 34, 10, MOUTH)) +
        viseme('u', 'U', ellipse('open', 0, 1, 10, 11, MOUTH)) +
        `</Solo></Node>`,
    ),
  );

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
  // Open mouth: 0 closed .. 1 fully open (the viseme shape scales up from nothing).
  tracks.push(
    anim(
      'tavi/mouthOpen',
      keyed(mouthIds.group, {
        scaleY: [
          [0, 0],
          [60, 1],
        ],
        scaleX: [
          [0, 0.6],
          [60, 1],
        ],
      }),
    ),
  );
  // Discrete selections: pose k is held from frame 10k (scrub to (10k + 5) / 60 s).
  tracks.push(
    anim(
      'tavi/viseme',
      keyedIds(mouthIds.solo, 'activeComponentId', [
        [0, mouthIds.a],
        [10, mouthIds.o],
        [20, mouthIds.e],
        [30, mouthIds.u],
      ]),
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

  // Animations go at the end of the lyla artboard (before its closing tag).
  const board = rml.indexOf(`name="${spec.artboard}"`);
  const close = rml.indexOf('\n    </Artboard>', board);
  rml =
    rml.slice(0, close) +
    '\n        ' +
    block('tracks', tracks.join('\n        ')) +
    rml.slice(close);

  return { rml, objects: next - 1 };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const file = process.argv[2] ?? 'art/mascot-remix/scene.rml';
  const { rml, objects } = authorTavi(readFileSync(file, 'utf8'));
  writeFileSync(file, rml);
  console.log(`authored ${String(objects)} objects into ${file}`);
}
