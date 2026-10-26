// In-memory .riv edits for character variants: setup-pose colours of fills and gradient stops,
// and float properties of transform components (bone lengths, node scales and positions).
// Every edit overwrites a fixed-width value in place, so the byte layout, component indices and
// every name, joystick and animation the motion rig depends on stay exactly the same.
import { artboardSection } from '../../attachments/riv/rivPatch';

const TYPE_SOLID_COLOR = 18;
const TYPE_GRADIENT_STOP = 19;
const PROP_SOLID_COLOR = 37;
const PROP_STOP_COLOR = 38;

/** Rewrites the setup colour of solid fills / gradient stops by component index (ARGB). */
export function setComponentColors(
  bytes: Uint8Array,
  artboard: string,
  colors: ReadonlyMap<number, number>,
): Uint8Array {
  if (!colors.size) return bytes;
  const { components } = artboardSection(bytes, artboard);
  const out = bytes.slice();
  const view = new DataView(out.buffer, out.byteOffset, out.byteLength);
  for (const [index, argb] of colors) {
    const component = components[index];
    const key =
      component?.typeKey === TYPE_SOLID_COLOR
        ? PROP_SOLID_COLOR
        : component?.typeKey === TYPE_GRADIENT_STOP
          ? PROP_STOP_COLOR
          : undefined;
    if (!component || key === undefined)
      throw new Error(`Variant colour target ${String(index)} is not a fill colour`);
    const offset = component.at.get(key);
    // A colour left at its default is not serialised; such fills cannot be recoloured in place.
    if (offset === undefined)
      throw new Error(`Variant colour target ${String(index)} has no stored colour`);
    view.setUint32(offset, argb >>> 0, true);
  }
  return out;
}

/** Reads the stored ARGB colour of a fill or gradient stop component. */
export function componentColor(
  bytes: Uint8Array,
  artboard: string,
  index: number,
): number | undefined {
  const component = artboardSection(bytes, artboard).components[index];
  const value = component?.props.get(component.typeKey === TYPE_GRADIENT_STOP ? 38 : 37);
  return typeof value === 'number' ? value >>> 0 : undefined;
}

export interface FloatEdit {
  /** Component index in the artboard. */
  index: number;
  /** Property key of a stored float (e.g. 13 x, 14 y, 16 scaleX, 17 scaleY, 89 bone length). */
  property: number;
  /** New value, or a function of the stored value. */
  value: number | ((stored: number) => number);
}

/** Rewrites stored float properties of components in place. Missing properties throw. */
export function setComponentFloats(
  bytes: Uint8Array,
  artboard: string,
  edits: readonly FloatEdit[],
): Uint8Array {
  if (!edits.length) return bytes;
  const { components } = artboardSection(bytes, artboard);
  const out = bytes.slice();
  const view = new DataView(out.buffer, out.byteOffset, out.byteLength);
  for (const edit of edits) {
    const component = components[edit.index];
    const offset = component?.at.get(edit.property);
    const stored = component?.props.get(edit.property);
    if (!component || offset === undefined || typeof stored !== 'number')
      throw new Error(
        `Variant edit target ${String(edit.index)}.${String(edit.property)} is not a stored float`,
      );
    const value = typeof edit.value === 'function' ? edit.value(stored) : edit.value;
    if (!Number.isFinite(value)) throw new Error('Variant edit produced a non-finite value');
    view.setFloat32(offset, value, true);
  }
  return out;
}
