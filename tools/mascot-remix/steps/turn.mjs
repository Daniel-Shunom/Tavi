// Turnaround step of the Lyla v2 pipeline: a three-quarter view from the existing front art.
// Called from author.mjs (`addTurnaround(rml)`), self-contained and idempotent: everything it
// writes sits in one `tavi:begin turnaround` block that authorTavi removes before re-authoring.
//
// Two continuous control timelines, keyed like the brows and mouth (60 frames: frame 0 is -1,
// 30 rest, 60 is +1; +1 turns toward screen-right):
//   tavi/turnHead  the face plane slides toward the turn side over the head (the existing
//                  face-plane constraints carry the features, glasses, bangs and ears), the far
//                  eye, lens and brow squash to ~0.7, the nose and mouth lead, the near ear comes
//                  round and the far one fades behind the head, the far temple hides, the side
//                  locks and back hair shift so the silhouette reads as turned.
//   tavi/turnBody  the torso and hips narrow, the far shoulder and leg tuck in and the near arm
//                  comes slightly forward.
// It keys only properties no other timeline keys (checked by tests/turnaround.test.ts), so it
// layers with the clips, joysticks and gait cycles.

/** Where the turn's parts live in the remix (RML component ids). L/R = screen-left/right. */
export const lylaTurnSpec = {
  head: {
    /** Face group (rotated slightly) and the two hidden constraint targets inside it. */
    faceGroup: '0:1283',
    faceShape: '0:568',
    facePlane: '0:1284',
    glassesPlane: '0:2835',
    /** Distance constraints that tie followers to the face plane (default distances). */
    distances: {
      features: '0:1290',
      glasses: '0:1293',
      skin: '0:1392',
      bangs: '0:1305',
      sides: '0:1310',
    },
    eyes: { L: '0:486', R: '0:516' },
    brows: { L: '0:474', R: '0:480' },
    lenses: { L: '0:428', R: '0:419' },
    temples: { L: '0:2322', R: '0:2314' },
    bridge: '0:2306',
    nose: '0:546',
    blush: '0:558',
    ears: { group: '0:1298', L: '0:586', R: '0:577' },
    bangs: { L: '0:438', R: '0:447' },
    sides: { L: '0:2121', R: '0:2119' },
    /** Hidden target the back hair follows. */
    backHair: '0:1318',
  },
  body: {
    shirt: '0:613',
    pants: '0:635',
    /** Left and right shirt shapes (the "shirt" node's scale belongs to variant builds). */
    shirtHalves: ['0:614', '0:625'],
    /** Arm groups inside the shoulders (the shoulders' x belongs to variant builds). */
    arms: { L: '0:2090', R: '0:2339' },
    legs: { L: '0:2518', R: '0:2507' },
    shoes: { L: '0:13091', R: '0:13183' },
    legIK: { L: '0:2560', R: '0:2505' },
  },
  /** Face-plane travel at a full turn (artboard units). */
  travel: 26,
};

const SIDES = /** @type {const} */ ([
  ['L', -1],
  ['R', 1],
]);
/** Sample points (frames) of each 60-frame track; linear in between. */
const FRAMES = [0, 6, 12, 18, 24, 30, 36, 42, 48, 54, 60];
const round = (value) => Math.round(value * 10000) / 10000;
const smooth = (x) => {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
};

/** Returns `rml` with the turnaround tracks (previous ones replaced). Pure. */
export function addTurnaround(source, spec = lylaTurnSpec, artboard = 'lyla animation') {
  const previous =
    /\n?[ \t]*<!-- tavi:begin turnaround -->[\s\S]*?<!-- tavi:end turnaround -->/.exec(source);
  // Keep the existing step in place when later authoring steps add timelines after it.
  // Removing it and appending at the artboard end changes pipeline ordering on every run.
  let rml = source.replace(
    /\n?[ \t]*<!-- tavi:begin turnaround -->[\s\S]*?<!-- tavi:end turnaround -->/g,
    '',
  );
  let next = 50000;
  const id = () => `7:${String(next++)}`;

  /** Opening tag of a component (throws if missing). */
  const tagOf = (component) => {
    const match = new RegExp(`<[A-Za-z]+ [^>]*? id="${component}"[^>]*>`).exec(rml);
    if (!match) throw new Error('turnaround: component not found: ' + component);
    return match[0];
  };
  const attr = (component, name, fallback) => {
    const value = new RegExp(`\\s${name}="([^"]*)"`).exec(tagOf(component))?.[1];
    return value === undefined ? fallback : Number(value);
  };
  /** Vertex ids of a shape's first path, in document order. */
  const vertices = (shape) => {
    const start = rml.indexOf(tagOf(shape));
    const end = rml.indexOf('</PointsPath>', start);
    return [...rml.slice(start, end).matchAll(/<\w*Vertex [^>]*?id="([^"]*)"/g)].map((m) => m[1]);
  };

  /** One keyed object whose properties are functions of t (-1..1). */
  const keyed = (component, props) =>
    `<KeyedObject objectId="${component}" id="${id()}">` +
    Object.entries(props)
      .map(
        ([property, f]) =>
          `<KeyedProperty property="${property}" id="${id()}">` +
          FRAMES.map(
            (frame) =>
              `<KeyFrameDouble value="${String(round(f(frame / 30 - 1)))}" interpolationType="linear" frame="${String(frame)}" id="${id()}"/>`,
          ).join('') +
          `</KeyedProperty>`,
      )
      .join('') +
    `</KeyedObject>`;
  // A bend direction is discrete in Rive. Switch close to the front pose,
  // where the legs are closest to straight, and retain the authored rest value.
  const keyedBend = (component, switchFrame) =>
    `<KeyedObject objectId="${component}" id="${id()}">` +
    `<KeyedProperty property="invertDirection" id="${id()}">` +
    `<KeyFrameBool value="false" frame="0" id="${id()}"/>` +
    `<KeyFrameBool value="true" frame="${switchFrame}" id="${id()}"/>` +
    `</KeyedProperty></KeyedObject>`;
  /** Farness (0..1) of a side for turn t: the side the face turns toward is the far one. */
  const far = (sign, t) => Math.max(0, sign * t);
  const near = (sign, t) => Math.max(0, -sign * t);

  // --- Head -----------------------------------------------------------------------------------
  const h = spec.head;
  const D = spec.travel;
  // The face group is rotated; move its constraint targets along the screen x axis.
  const rotation = attr(h.faceGroup, 'rotation', 0);
  const along = (component, amount) => {
    const x0 = attr(component, 'x', 0),
      y0 = attr(component, 'y', 0);
    return keyed(component, {
      x: (t) => x0 + amount(t) * Math.cos(-rotation),
      y: (t) => y0 + amount(t) * Math.sin(-rotation),
    });
  };
  const distance = (component, f) => {
    const d0 = attr(component, 'distance', 100);
    return keyed(component, { distance: (t) => f(d0, Math.abs(t)) });
  };
  let head =
    // The face plane slides; the features and glasses close their slack so they follow from
    // the start, the skin and side locks get slack so they stay, the bangs follow halfway.
    along(h.facePlane, (t) => D * t) +
    along(h.glassesPlane, (t) => D * t) +
    distance(h.distances.features, (d0, a) => d0 * (1 - a)) +
    distance(h.distances.glasses, (d0, a) => d0 * (1 - a)) +
    distance(h.distances.skin, (d0, a) => d0 + D * a) +
    distance(h.distances.sides, (d0, a) => d0 + D * a) +
    distance(h.distances.bangs, (d0, a) => d0 + 0.45 * D * a);
  // Project the skull and jaw, not just its features. Shape transforms remain independent
  // of the setup-pose vertex edits that provide the variant face shapes.
  const faceX = attr(h.faceShape, 'x', 0),
    faceScale = attr(h.faceShape, 'scaleX', 1);
  head += keyed(h.faceShape, {
    x: (t) => faceX + 4 * t,
    scaleX: (t) => faceScale * (1 - 0.14 * Math.abs(t)),
  });
  const outline = vertices(h.faceShape);
  for (const [corner, travel] of [
    [1, 9],
    [3, 3],
  ]) {
    const vertex = outline[corner];
    if (!vertex) throw new Error('turnaround: face outline missing corner ' + corner);
    const x0 = attr(vertex, 'x', 0);
    head += keyed(vertex, { x: (t) => x0 + travel * t });
  }
  // Nose leads, cheeks follow a little.
  const noseX = attr(h.nose, 'x', 0),
    blushX = attr(h.blush, 'x', 0);
  head += keyed(h.nose, { x: (t) => noseX + 10 * t });
  head += keyed(h.blush, { x: (t) => blushX + 3 * t });
  // The back hair shows more on the near side (the back of the head).
  const backX = attr(h.backHair, 'x', 0);
  head += keyed(h.backHair, { x: (t) => backX - 6 * t });
  // The ears follow the face plane exactly; hold them on the head instead.
  head += keyed(h.ears.group, { x: (t) => attr(h.ears.group, 'x', 0) - D * t });
  for (const [side, sign] of SIDES) {
    // Eyes: both draw in toward the nose; the far one squashes.
    const eye = h.eyes[side];
    const eyeX = attr(eye, 'x', 0),
      eyeSX = attr(eye, 'scaleX', 1);
    head += keyed(eye, {
      x: (t) => eyeX - sign * (4 * near(sign, t) + 5 * far(sign, t)),
      scaleX: (t) => eyeSX * (1 - 0.44 * far(sign, t) + 0.02 * near(sign, t)),
    });
    // Brows: the transform is joystick-owned, so squash and shift the path's vertices.
    for (const vertex of vertices(h.brows[side])) {
      const vx = attr(vertex, 'x', 0);
      head += keyed(vertex, {
        x: (t) => vx * (1 - 0.28 * far(sign, t)) - sign * (4 * near(sign, t) + 5 * far(sign, t)),
      });
    }
    // Lenses squash with the eyes; the far temple slips behind the head, the near one shows.
    const lens = h.lenses[side];
    const lensX = attr(lens, 'x', 0),
      lensSX = attr(lens, 'scaleX', 1);
    head += keyed(lens, {
      x: (t) => lensX - sign * (4 * near(sign, t) + 11 * far(sign, t)),
      scaleX: (t) => lensSX * (1 - 0.44 * far(sign, t) + 0.02 * near(sign, t)),
    });
    const temple = h.temples[side];
    const templeX = attr(temple, 'x', 0);
    head += keyed(temple, {
      x: (t) => templeX - sign * (5 * near(sign, t) + 18 * far(sign, t)),
      opacity: (t) => 1 - smooth(far(sign, t) / 0.45),
    });
    // Ears: the near ear comes round toward the cheek and grows, the far one hides.
    const ear = h.ears[side];
    const earX = attr(ear, 'x', 0),
      earSX = attr(ear, 'scaleX', 1),
      earSY = attr(ear, 'scaleY', 1);
    head += keyed(ear, {
      x: (t) => earX - sign * (5 * near(sign, t) + 12 * far(sign, t)),
      scaleX: (t) => earSX * (1 + 0.1 * near(sign, t) - 0.3 * far(sign, t)),
      scaleY: (t) => earSY * (1 + 0.08 * near(sign, t)),
      opacity: (t) => 1 - smooth(far(sign, t) / 0.6),
    });
    // Bangs: the far lock narrows, the near one widens a touch.
    const bang = h.bangs[side];
    const bangX = attr(bang, 'x', 0),
      bangSX = attr(bang, 'scaleX', 1);
    head += keyed(bang, {
      x: (t) => bangX - sign * 4 * far(sign, t),
      scaleX: (t) => bangSX * (1 - 0.16 * far(sign, t) + 0.06 * near(sign, t)),
    });
    // Side locks: both draw in toward the turned silhouette, the far one most.
    const lock = h.sides[side];
    const lockX = attr(lock, 'x', 0);
    head += keyed(lock, {
      x: (t) => lockX - sign * (3 * near(sign, t) + 9 * far(sign, t)),
    });
  }
  const bridgeX = attr(h.bridge, 'x', 0);
  head += keyed(h.bridge, { x: (t) => bridgeX + 2 * t });

  // --- Body -----------------------------------------------------------------------------------
  const b = spec.body;
  // The shirt's own scale and the shoulder groups' x are variant build edits
  // (characters/variants/rigs/mascotV2.ts), so narrow the shirt halves and move the arms inside.
  const shirtX = attr(b.shirt, 'x', 0),
    pantsSX = attr(b.pants, 'scaleX', 1);
  const shirtRotation = attr(b.shirt, 'rotation', 0),
    pantsRotation = attr(b.pants, 'rotation', 0);
  let body =
    keyed(b.shirt, {
      x: (t) => shirtX + 2 * t,
      rotation: (t) => shirtRotation + 0.08 * t,
    }) +
    keyed(b.pants, {
      scaleX: (t) => pantsSX * (1 - 0.28 * Math.abs(t)),
      rotation: (t) => pantsRotation + 0.04 * t,
    });
  for (const [index, half] of b.shirtHalves.entries()) {
    const sign = index === 0 ? -1 : 1;
    const halfX = attr(half, 'x', 0),
      halfSX = attr(half, 'scaleX', 1);
    body += keyed(half, {
      // Unequal near and far planes make the chest read as a turn rather than a
      // uniformly squeezed front view. Keep the halves overlapping at the seam.
      x: (t) => halfX * (1 - 0.48 * far(sign, t) - 0.3 * near(sign, t)) + t,
      scaleX: (t) => halfSX * (1 - 0.48 * far(sign, t) - 0.3 * near(sign, t)),
    });
  }
  for (const [side, sign] of SIDES) {
    const arm = b.arms[side];
    const armX = attr(arm, 'x', 0),
      armSX = attr(arm, 'scaleX', 1),
      armSY = attr(arm, 'scaleY', 1);
    body += keyed(arm, {
      x: (t) => armX - sign * (4 * near(sign, t) + 22 * far(sign, t)),
      scaleX: (t) => armSX * (1 + 0.1 * near(sign, t) - 0.32 * far(sign, t)),
      scaleY: (t) => armSY * (1 + 0.08 * near(sign, t) - 0.14 * far(sign, t)),
    });
    const leg = b.legs[side];
    const legX = attr(leg, 'x', 0);
    body += keyed(leg, {
      // Shift the hip for overlap, but leave the whole leg's width and length
      // to the rig: scaling this group changes the apparent leg volume.
      x: (t) => legX - sign * (5 * near(sign, t) + 14 * far(sign, t)),
    });
    body += keyedBend(b.legIK[side], 30);
    // Toe extension is a path deformation, not a leg transform: the ankle
    // vertices stay fixed and only the lower outer edge projects forward.
    for (const vertex of vertices(b.shoes[side])) {
      const x = attr(vertex, 'x', 0);
      const y = attr(vertex, 'y', 0);
      const sole = Math.max(0, Math.min(1, (y - 4) / 6));
      if (!sole) continue;
      const right = Math.max(0, Math.min(1, x / 27));
      const left = 1 - right;
      body += keyed(vertex, {
        x: (t) => x + 12 * sole * (right * Math.max(t, 0) - left * Math.max(-t, 0)),
      });
    }
  }

  const track = (name, content) =>
    `<LinearAnimation duration="60" name="${name}" id="${id()}">${content}</LinearAnimation>`;
  const block =
    '<!-- tavi:begin turnaround -->' +
    track('tavi/turnHead', head) +
    '\n        ' +
    track('tavi/turnBody', body) +
    '<!-- tavi:end turnaround -->';
  const board = rml.indexOf(`name="${artboard}"`);
  if (board < 0) throw new Error('turnaround: artboard not found: ' + artboard);
  const close = previous?.index ?? rml.indexOf('\n    </Artboard>', board);
  return rml.slice(0, close) + '\n        ' + block + rml.slice(close);
}
