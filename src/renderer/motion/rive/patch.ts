// In-memory rig extension for exported .riv files. The source file on disk is never modified.
//
// Why: exported Rive files strip component names (so artboard.node()/bone() cannot find
// anything), and joystick-driven rigs re-apply their channel animations from the joystick's
// x/y on every update pass, so scrubbing a channel animation directly is overwritten. The
// low-level runtime has no API for joystick values. Two additive patches fix both:
//   1. runtime names on chosen components, so procedural code can read/offset transforms;
//   2. "control tracks": tiny linear animations that key exactly one property from min to max
//      over one second. Scrubbing one to time t sets that property to an exact value with no
//      side effects, and its mix blends it over whatever the performance clips keyed.
// New animations are appended after the artboard's existing ones, so every existing animation
// index (joystick xId/yId, state-machine animationId) is unchanged.
import { RivWriter, scanRiv, splice, type RivObject } from '../../attachments/riv/rivBinary';

const TYPE_ARTBOARD = 1;
const TYPE_LINEAR_ANIMATION = 31;
const TYPE_STATE_MACHINE = 53;
const TYPE_KEYED_OBJECT = 25;
const TYPE_KEYED_PROPERTY = 26;
const TYPE_KEYFRAME_DOUBLE = 30;
const PROP_COMPONENT_NAME = 4;
const PROP_ANIMATION_NAME = 55;
const PROP_FPS = 56;
const PROP_DURATION = 57;
const PROP_LOOP = 59;
const PROP_OBJECT_ID = 51;
const PROP_PROPERTY_KEY = 53;
const PROP_FRAME = 67;
const PROP_INTERPOLATION = 68;
const PROP_VALUE = 70;
const INTERPOLATION_LINEAR = 1;

/** Core property keys usable in control tracks (rive-runtime generated headers). */
export const RiveProperty = {
  x: 13,
  y: 14,
  rotation: 15,
  scaleX: 16,
  scaleY: 17,
  opacity: 18,
  joystickX: 299,
  joystickY: 300,
} as const;

export interface ControlTrack {
  /** Animation name to create; must not collide with existing names. */
  name: string;
  /** Component index inside the artboard (artboard itself is 0), as keyed objects reference it. */
  objectIndex: number;
  propertyKey: number;
  min: number;
  max: number;
}

export interface RigPatch {
  artboard: string;
  names?: Readonly<Record<number, string>>;
  controls?: readonly ControlTrack[];
  /** Optional sanity checks: component index -> expected core type key. */
  expectTypes?: Readonly<Record<number, number>>;
}

export const CONTROL_FPS = 60;

/** Seconds into a control track that produce `value`. */
export function controlTime(track: Pick<ControlTrack, 'min' | 'max'>, value: number) {
  const t = (value - track.min) / (track.max - track.min);
  return Math.min(1, Math.max(0, t));
}

interface ArtboardSection {
  artboard: RivObject;
  components: RivObject[];
  insertAt: number;
  animationNames: Set<string>;
}

function section(objects: RivObject[], name: string): ArtboardSection {
  const index = objects.findIndex(
    (o) => o.typeKey === TYPE_ARTBOARD && o.props.get(PROP_COMPONENT_NAME) === name,
  );
  const artboard = objects[index];
  if (!artboard) throw new Error('Artboard not found: ' + name);
  const components: RivObject[] = [artboard];
  const animationNames = new Set<string>();
  let insertAt = -1;
  let inComponents = true;
  for (let i = index + 1; i < objects.length; i++) {
    const object = objects[i];
    if (!object || object.typeKey === TYPE_ARTBOARD) {
      if (insertAt < 0) insertAt = object ? object.start : -1;
      break;
    }
    if (object.typeKey === TYPE_LINEAR_ANIMATION) {
      inComponents = false;
      const animationName = object.props.get(PROP_ANIMATION_NAME);
      if (typeof animationName === 'string') animationNames.add(animationName);
    } else if (object.typeKey === TYPE_STATE_MACHINE) {
      inComponents = false;
      if (insertAt < 0) insertAt = object.start;
    }
    if (inComponents) components.push(object);
  }
  const last = objects.at(-1);
  if (insertAt < 0 && last) insertAt = last.end;
  return { artboard, components, insertAt, animationNames };
}

export function patchRiv(bytes: Uint8Array, patch: RigPatch): Uint8Array {
  const scan = scanRiv(bytes);
  if (scan.major !== 7) throw new Error('Unsupported .riv major version ' + String(scan.major));
  const board = section(scan.objects, patch.artboard);
  const insertions: { at: number; bytes: Uint8Array }[] = [];
  for (const [index, expected] of Object.entries(patch.expectTypes ?? {})) {
    const actual = board.components[Number(index)]?.typeKey;
    if (actual !== expected)
      throw new Error(
        'Rig mismatch at component ' +
          index +
          ': expected type ' +
          String(expected) +
          ', found ' +
          String(actual),
      );
  }
  for (const [index, name] of Object.entries(patch.names ?? {})) {
    const component = board.components[Number(index)];
    if (!component) throw new Error('No component at index ' + index);
    if (component.props.has(PROP_COMPONENT_NAME)) continue; // keep authored names
    insertions.push({
      at: component.terminator,
      bytes: new RivWriter().stringProp(PROP_COMPONENT_NAME, name).bytes(),
    });
  }
  const tracks = new RivWriter();
  for (const control of patch.controls ?? []) {
    if (board.animationNames.has(control.name))
      throw new Error('Control track name already exists: ' + control.name);
    if (!board.components[control.objectIndex])
      throw new Error('No component at index ' + String(control.objectIndex));
    tracks
      .object(TYPE_LINEAR_ANIMATION)
      .stringProp(PROP_ANIMATION_NAME, control.name)
      .uintProp(PROP_FPS, CONTROL_FPS)
      .uintProp(PROP_DURATION, CONTROL_FPS)
      .uintProp(PROP_LOOP, 0)
      .end()
      .object(TYPE_KEYED_OBJECT)
      .uintProp(PROP_OBJECT_ID, control.objectIndex)
      .end()
      .object(TYPE_KEYED_PROPERTY)
      .uintProp(PROP_PROPERTY_KEY, control.propertyKey)
      .end();
    for (const [frame, value] of [
      [0, control.min],
      [CONTROL_FPS, control.max],
    ] as const)
      tracks
        .object(TYPE_KEYFRAME_DOUBLE)
        .uintProp(PROP_FRAME, frame)
        .uintProp(PROP_INTERPOLATION, INTERPOLATION_LINEAR)
        .doubleProp(PROP_VALUE, value)
        .end();
  }
  const trackBytes = tracks.bytes();
  if (trackBytes.length) insertions.push({ at: board.insertAt, bytes: trackBytes });
  return splice(bytes, insertions);
}

/** Lists components of an artboard as [index, typeKey] for audits and tests. */
export function artboardComponents(bytes: Uint8Array, artboard: string) {
  return section(scanRiv(bytes).objects, artboard).components.map(
    (component, index) => [index, component.typeKey, component.props] as const,
  );
}
