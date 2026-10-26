// In-memory .riv edits for character variants: setup-pose colours of fills and gradient stops,
// and float properties of components (node scales and positions, stroke thickness, vertex
// positions). Values are overwritten in place; a property left at its default is not stored, so
// it is inserted into that component's property list. Objects are never added, removed or
// reordered, so component indices, names, joysticks and animations stay exactly the same.
import { artboardSection } from '../../attachments/riv/rivPatch';
import { RivWriter, splice, type RivObject } from '../../attachments/riv/rivBinary';

export const TYPE = {
  node: 2,
  shape: 3,
  solidColor: 18,
  gradientStop: 19,
  linearGradient: 22,
  radialGradient: 17,
  fill: 20,
  stroke: 24,
  rootBone: 41,
  bone: 40,
} as const;
export const PROP = {
  name: 4,
  parent: 5,
  x: 13,
  y: 14,
  rotation: 15,
  scaleX: 16,
  scaleY: 17,
  vertexX: 24,
  vertexY: 25,
  solidColor: 37,
  stopColor: 38,
  thickness: 47,
  inRotation: 84,
  inDistance: 85,
  outRotation: 86,
  outDistance: 87,
  boneLength: 89,
} as const;
/** Runtime defaults of float properties, used when the file does not store them. */
const FLOAT_DEFAULTS: Readonly<Record<number, number>> = {
  [PROP.x]: 0,
  [PROP.y]: 0,
  [PROP.rotation]: 0,
  [PROP.scaleX]: 1,
  [PROP.scaleY]: 1,
  [PROP.vertexX]: 0,
  [PROP.vertexY]: 0,
  [PROP.thickness]: 1,
  [PROP.inRotation]: 0,
  [PROP.inDistance]: 0,
  [PROP.outRotation]: 0,
  [PROP.outDistance]: 0,
};
const COLOR_DEFAULT = 0xff747474;

export interface FloatEdit {
  /** Component index in the artboard. */
  index: number;
  property: number;
  /** New value, or a function of the stored (or default) value. */
  value: number | ((stored: number) => number);
}

export interface ComponentEdits {
  /** Fill / gradient stop component index -> ARGB colour. */
  colors?: ReadonlyMap<number, number>;
  floats?: readonly FloatEdit[];
}

function colorKeyOf(component: RivObject) {
  if (component.typeKey === TYPE.solidColor) return PROP.solidColor;
  if (component.typeKey === TYPE.gradientStop) return PROP.stopColor;
  return undefined;
}

/** Applies colour and float edits to one artboard's setup pose. Unknown targets throw. */
export function editComponents(
  bytes: Uint8Array,
  artboard: string,
  edits: ComponentEdits,
): Uint8Array {
  const colors = edits.colors ?? new Map<number, number>();
  const floats = edits.floats ?? [];
  if (!colors.size && !floats.length) return bytes;
  const { components } = artboardSection(bytes, artboard);
  const out = bytes.slice();
  const view = new DataView(out.buffer, out.byteOffset, out.byteLength);
  const inserts: { at: number; bytes: Uint8Array }[] = [];
  for (const [index, argb] of colors) {
    const component = components[index];
    const key = component && colorKeyOf(component);
    if (!component || key === undefined)
      throw new Error(`Variant colour target ${String(index)} is not a fill colour`);
    const offset = component.at.get(key);
    if (offset !== undefined) view.setUint32(offset, argb >>> 0, true);
    else {
      const writer = new RivWriter().varuint(key);
      const raw = new DataView(new ArrayBuffer(4));
      raw.setUint32(0, argb >>> 0, true);
      const head = writer.bytes();
      const bytesOut = new Uint8Array(head.length + 4);
      bytesOut.set(head);
      bytesOut.set(new Uint8Array(raw.buffer), head.length);
      inserts.push({ at: component.terminator, bytes: bytesOut });
    }
  }
  // Several edits of one property compose in order.
  const pending = new Map<string, { component: RivObject; property: number; value: number }>();
  for (const edit of floats) {
    const component = components[edit.index];
    if (!component) throw new Error(`Variant edit target ${String(edit.index)} does not exist`);
    const key = `${String(edit.index)}.${String(edit.property)}`;
    const stored = component.props.get(edit.property);
    const current =
      pending.get(key)?.value ??
      (typeof stored === 'number' ? stored : FLOAT_DEFAULTS[edit.property]);
    if (current === undefined)
      throw new Error(`Variant edit property ${key} has no stored value or known default`);
    const value = typeof edit.value === 'function' ? edit.value(current) : edit.value;
    if (!Number.isFinite(value)) throw new Error('Variant edit produced a non-finite value');
    pending.set(key, { component, property: edit.property, value });
  }
  for (const { component, property, value } of pending.values()) {
    const offset = component.at.get(property);
    if (offset !== undefined) view.setFloat32(offset, value, true);
    else
      inserts.push({
        at: component.terminator,
        bytes: new RivWriter().doubleProp(property, value).bytes(),
      });
  }
  return inserts.length ? splice(out, inserts) : out;
}

/** Reads the stored ARGB colour of a fill or gradient stop component (default when absent). */
export function componentColor(component: RivObject): number | undefined {
  const key = colorKeyOf(component);
  if (key === undefined) return undefined;
  const value = component.props.get(key);
  return typeof value === 'number' ? value >>> 0 : COLOR_DEFAULT;
}

export function componentName(component: RivObject | undefined): string {
  const value = component?.props.get(PROP.name);
  return typeof value === 'string' ? value : '';
}
export function componentParent(component: RivObject | undefined): number | undefined {
  const value = component?.props.get(PROP.parent);
  return typeof value === 'number' ? value : undefined;
}
