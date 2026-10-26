// In-memory .riv patches for appearance: runtime names on transform components (so attachment
// slots can read world transforms) and in-place recolouring of the colour keys of appearance
// animations such as "hair Pink". The source file is never modified; colours are fixed-width,
// so recolouring never changes the byte layout.
import { RivWriter, scanRiv, splice, type RivObject } from './rivBinary';

const TYPE_ARTBOARD = 1;
const TYPE_LINEAR_ANIMATION = 31;
const TYPE_STATE_MACHINE = 53;
const TYPE_KEYED_OBJECT = 25;
const TYPE_KEYED_PROPERTY = 26;
const TYPE_KEYFRAME_COLOR = 37;
const PROP_COMPONENT_NAME = 4;
const PROP_ANIMATION_NAME = 55;
const PROP_OBJECT_ID = 51;
const PROP_PROPERTY_KEY = 53;
const PROP_KEYFRAME_COLOR = 88;

export interface ArtboardSection {
  components: RivObject[];
  animations: { name: string; objects: RivObject[] }[];
}

export function artboardSection(bytes: Uint8Array, name: string): ArtboardSection {
  const objects = scanRiv(bytes).objects;
  const start = objects.findIndex(
    (o) => o.typeKey === TYPE_ARTBOARD && o.props.get(PROP_COMPONENT_NAME) === name,
  );
  const artboard = objects[start];
  if (!artboard) throw new Error('Artboard not found: ' + name);
  const components: RivObject[] = [artboard];
  const animations: ArtboardSection['animations'] = [];
  let mode: 'components' | 'animation' | 'other' = 'components';
  for (let i = start + 1; i < objects.length; i++) {
    const object = objects[i];
    if (!object || object.typeKey === TYPE_ARTBOARD) break;
    if (object.typeKey === TYPE_LINEAR_ANIMATION) {
      mode = 'animation';
      const animationName = object.props.get(PROP_ANIMATION_NAME);
      animations.push({
        name: typeof animationName === 'string' ? animationName : '',
        objects: [],
      });
      continue;
    }
    if (object.typeKey === TYPE_STATE_MACHINE) mode = 'other';
    if (mode === 'components') components.push(object);
    else if (mode === 'animation') animations.at(-1)?.objects.push(object);
  }
  return { components, animations };
}

/** Adds runtime names to unnamed components (index -> name); authored names are kept. */
export function nameComponents(
  bytes: Uint8Array,
  artboard: string,
  names: Readonly<Record<number, string>>,
): Uint8Array {
  const { components } = artboardSection(bytes, artboard);
  const insertions: { at: number; bytes: Uint8Array }[] = [];
  for (const [index, name] of Object.entries(names)) {
    const component = components[Number(index)];
    if (!component) throw new Error('No component at index ' + index);
    if (component.props.has(PROP_COMPONENT_NAME)) continue;
    insertions.push({
      at: component.terminator,
      bytes: new RivWriter().stringProp(PROP_COMPONENT_NAME, name).bytes(),
    });
  }
  return splice(bytes, insertions);
}

export interface ColorKey {
  objectIndex: number;
  propertyKey: number;
  /** ARGB colour as stored (0xAARRGGBB). */
  value: number;
  /** Byte offset of the 4-byte little-endian value. */
  offset: number;
}

function animationColorKeys(bytes: Uint8Array, artboard: string, animation: string): ColorKey[] {
  const entry = artboardSection(bytes, artboard).animations.find((a) => a.name === animation);
  if (!entry) throw new Error('Animation not found: ' + animation);
  const keys: ColorKey[] = [];
  let objectIndex = -1,
    propertyKey = -1;
  for (const object of entry.objects) {
    if (object.typeKey === TYPE_KEYED_OBJECT)
      objectIndex = Number(object.props.get(PROP_OBJECT_ID) ?? -1);
    else if (object.typeKey === TYPE_KEYED_PROPERTY)
      propertyKey = Number(object.props.get(PROP_PROPERTY_KEY) ?? -1);
    else if (object.typeKey === TYPE_KEYFRAME_COLOR) {
      const offset = object.at.get(PROP_KEYFRAME_COLOR);
      const value = object.props.get(PROP_KEYFRAME_COLOR);
      if (offset !== undefined && typeof value === 'number')
        keys.push({ objectIndex, propertyKey, value: value >>> 0, offset });
    }
  }
  return keys;
}

/** Colour keys of one animation as #aarrggbb strings, for audits and probes. */
export function colorKeys(bytes: Uint8Array, artboard: string, animation: string) {
  return animationColorKeys(bytes, artboard, animation).map(
    (key) =>
      `${String(key.objectIndex)}:${String(key.propertyKey)}=#${key.value.toString(16).padStart(8, '0')}`,
  );
}

/** Returns a copy where every colour key of `animation` is passed through `remap`. */
export function recolorAnimation(
  bytes: Uint8Array,
  artboard: string,
  animation: string,
  remap: (argb: number, key: ColorKey) => number,
): Uint8Array {
  const out = bytes.slice();
  const view = new DataView(out.buffer, out.byteOffset, out.byteLength);
  for (const key of animationColorKeys(bytes, artboard, animation))
    view.setUint32(key.offset, remap(key.value, key) >>> 0, true);
  return out;
}
