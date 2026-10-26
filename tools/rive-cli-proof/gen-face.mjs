// Generates scene.rml for the Rive CLI proof: a tiny chibi face with brow, mouth and blink
// range timelines (authored joystick-style: first frame = -1 pose, middle = rest, last = +1),
// an "oops" one-shot and a state machine. Usage: node gen-face.mjs <project-dir>
import { writeFileSync } from 'node:fs';

const dir = process.argv[2];
let next = 100;
const id = () => `0:${String(next++)}`;
const ids = {
  head: id(),
  eyeL: id(),
  eyeR: id(),
  browL: id(),
  browR: id(),
  mouth: id(),
  vL: id(),
  vM: id(),
  vR: id(),
  cheekL: id(),
  cheekR: id(),
  brows: id(),
  mouthAnim: id(),
  blink: id(),
  oops: id(),
  sm: id(),
  layer: id(),
  idle: id(),
  oopsState: id(),
};
const K = { x: 13, y: 14, rotation: 15, scaleX: 16, scaleY: 17, vx: 24, vy: 25, opacity: 18 };
const kf = (frames, interp = 2) =>
  frames
    .map(
      ([frame, value]) =>
        `<KeyFrameDouble frame="${frame}" value="${value}" interpolationType="${interp}"/>`,
    )
    .join('');
const keyed = (objectId, props) =>
  `<KeyedObject objectId="${objectId}">${Object.entries(props)
    .map(([key, frames]) => `<KeyedProperty propertyKey="${K[key]}">${kf(frames)}</KeyedProperty>`)
    .join('')}</KeyedObject>`;
const anim = (name, animId, duration, body, loop = 0) =>
  `<LinearAnimation name="${name}" id="${animId}" fps="60" duration="${duration}" loopValue="${loop}">${body}</LinearAnimation>`;
const fill = (color) => `<Fill name="Fill"><SolidColor colorValue="${color}" name="Color"/></Fill>`;
const stroke = (color, w) =>
  `<Stroke thickness="${w}" cap="1" join="1" name="Stroke"><SolidColor colorValue="${color}" name="Color"/></Stroke>`;

const ink = 'FF3A2340';
const scene = `<Rive version="1" kind="fragment">
<Artboard defaultStateMachineId="${ids.sm}" styleId="0:3" width="300" height="300" name="Face" id="0:2">
  <LayoutComponentStyle name="Artboard Style" id="0:3"/>
  <Shape x="96" y="196" name="CheekL" id="${ids.cheekL}"><Ellipse width="30" height="16" name="Path"/>${fill('66FF7A8A')}</Shape>
  <Shape x="204" y="196" name="CheekR" id="${ids.cheekR}"><Ellipse width="30" height="16" name="Path"/>${fill('66FF7A8A')}</Shape>
  <Shape x="112" y="168" name="EyeL" id="${ids.eyeL}"><Ellipse width="24" height="34" name="Path"/>${fill(ink)}</Shape>
  <Shape x="188" y="168" name="EyeR" id="${ids.eyeR}"><Ellipse width="24" height="34" name="Path"/>${fill(ink)}</Shape>
  <Shape x="110" y="128" name="BrowL" id="${ids.browL}"><Rectangle width="46" height="10" cornerRadiusTL="5" name="Path"/>${fill(ink)}</Shape>
  <Shape x="190" y="128" name="BrowR" id="${ids.browR}"><Rectangle width="46" height="10" cornerRadiusTL="5" name="Path"/>${fill(ink)}</Shape>
  <Shape x="150" y="214" name="Mouth" id="${ids.mouth}">
    <PointsPath name="Path"><StraightVertex x="-22" y="0" name="L" id="${ids.vL}"/><StraightVertex x="0" y="6" radius="22" name="M" id="${ids.vM}"/><StraightVertex x="22" y="0" name="R" id="${ids.vR}"/></PointsPath>
    ${stroke(ink, 7)}
  </Shape>
  <Shape x="150" y="160" name="Head" id="${ids.head}"><Ellipse width="210" height="196" name="Path"/>${fill('FFFFC9B5')}</Shape>
  <StateMachine name="Face" id="${ids.sm}">
    <StateMachineLayer name="Expression" id="${ids.layer}">
      <EntryState><StateTransition stateToId="${ids.oopsState}"/></EntryState>
      <AnimationState x="200" y="0" animationId="${ids.oops}" id="${ids.oopsState}"/>
    </StateMachineLayer>
  </StateMachine>
  ${anim(
    'brows',
    ids.brows,
    60,
    keyed(ids.browL, {
      y: [
        [0, 106],
        [30, 128],
        [60, 136],
      ],
      rotation: [
        [0, -0.16],
        [30, 0],
        [60, 0.32],
      ],
    }) +
      keyed(ids.browR, {
        y: [
          [0, 106],
          [30, 128],
          [60, 136],
        ],
        rotation: [
          [0, 0.16],
          [30, 0],
          [60, -0.32],
        ],
      }),
  )}
  ${anim(
    'mouth-curve',
    ids.mouthAnim,
    60,
    keyed(ids.vL, {
      vy: [
        [0, 8],
        [30, 0],
        [60, -6],
      ],
    }) +
      keyed(ids.vR, {
        vy: [
          [0, 8],
          [30, 0],
          [60, -6],
        ],
      }) +
      keyed(ids.vM, {
        vy: [
          [0, -6],
          [30, 6],
          [60, 18],
        ],
      }),
  )}
  ${anim(
    'blink',
    ids.blink,
    60,
    keyed(ids.eyeL, {
      scaleY: [
        [0, 1],
        [60, 0.08],
      ],
    }) +
      keyed(ids.eyeR, {
        scaleY: [
          [0, 1],
          [60, 0.08],
        ],
      }),
  )}
  ${anim(
    'oops',
    ids.oops,
    90,
    // Startled brow lift, eyes dart to the side, wide flat "uh-oh" grimace, slight squash back.
    keyed(ids.browL, {
      y: [
        [0, 128],
        [6, 102],
        [90, 108],
      ],
      rotation: [
        [0, 0],
        [6, -0.2],
        [90, -0.12],
      ],
    }) +
      keyed(ids.browR, {
        y: [
          [0, 128],
          [6, 100],
          [90, 110],
        ],
        rotation: [
          [0, 0],
          [6, 0.2],
          [90, 0.1],
        ],
      }) +
      keyed(ids.eyeL, {
        x: [
          [0, 112],
          [18, 112],
          [26, 124],
          [90, 124],
        ],
        scaleY: [
          [0, 1],
          [3, 0.1],
          [7, 1.1],
          [90, 1.05],
        ],
      }) +
      keyed(ids.eyeR, {
        x: [
          [0, 188],
          [18, 188],
          [26, 200],
          [90, 200],
        ],
        scaleY: [
          [0, 1],
          [3, 0.1],
          [7, 1.1],
          [90, 1.05],
        ],
      }) +
      keyed(ids.vL, {
        vx: [
          [0, -22],
          [8, -34],
          [90, -32],
        ],
        vy: [
          [0, 0],
          [8, 3],
          [90, 2],
        ],
      }) +
      keyed(ids.vR, {
        vx: [
          [0, 22],
          [8, 34],
          [90, 32],
        ],
        vy: [
          [0, 0],
          [8, -2],
          [90, -1],
        ],
      }) +
      keyed(ids.vM, {
        vy: [
          [0, 6],
          [8, 0],
          [90, 1],
        ],
      }) +
      keyed(ids.head, {
        scaleY: [
          [0, 1],
          [5, 1.04],
          [14, 0.98],
          [24, 1],
        ],
        scaleX: [
          [0, 1],
          [5, 0.97],
          [14, 1.01],
          [24, 1],
        ],
      }),
  )}
</Artboard>
</Rive>
`;
writeFileSync(`${dir}/scene.rml`, scene);
