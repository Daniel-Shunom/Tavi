// A character's variant rig: which of its fills are skin, eyes and hair, which components the
// build and face shape edit, and which named nodes/bones hair and feature overlays follow.
// Parts are selected by component name (with an optional ancestor name), so the rig survives
// re-exports of the same source as long as names are kept. Pure; no DOM, no runtime.
import { artboardSection } from '../../attachments/riv/rivPatch';
import type { RivObject } from '../../attachments/riv/rivBinary';
import { TYPE, componentName, componentParent } from './rivEdit';

/** A named component, optionally only inside an ancestor with a given name. */
export interface Selector {
  name: string;
  under?: string;
  /** For gradients: which stop (0 = first in the file). Omit for every stop / solid fills. */
  stop?: number;
  /** Parts another workstream may rebuild (e.g. the mouth): skipped when absent, never fatal. */
  optional?: boolean;
}

export type ColorRole =
  /** skinLid: eyelid patches that blend into the face gradient at eye height. */
  | 'skin'
  | 'skinShade'
  | 'skinHighlight'
  | 'skinLid'
  | 'blush'
  | 'nose'
  | 'mouth'
  | 'irisDark'
  | 'irisLight';

export type OverlayAnchor =
  'head' | 'face' | 'hairBack' | 'hairLeft' | 'hairRight' | 'upper' | 'forearmL' | 'forearmR';

export interface AnchorBinding {
  /** Runtime name of the node/bone (looked up with artboard.node / artboard.bone). */
  name: string;
  kind: 'node' | 'bone';
}

export interface ScaleEdit {
  target: Selector;
  property: 'scaleX' | 'scaleY' | 'x' | 'y' | 'thickness';
  /** Multiplier (scales, thickness) or offset in artboard units (x, y). */
  amount: number;
}

export interface VariantRig {
  /** Character id this rig belongs to (manifest id). */
  character: string;
  artboard: string;
  colors: Readonly<Record<ColorRole, readonly Selector[]>>;
  hair: {
    /** Shapes of the built-in hairstyle (hidden when another style or a covering is chosen). */
    shapes: readonly Selector[];
    /** Hair colour animations and their main colour, rewritten for custom hair colours. */
    animations: readonly { name: string; base: string }[];
    /** Brow shapes: keyed by the hair animations, kept visible and recoloured to the brow colour. */
    brows: readonly Selector[];
  };
  /** Appearance animations of the built-in glasses (made transparent when glasses are off). */
  glasses: readonly string[];
  /** Per-build edits relative to the authored (average) body. */
  builds: Readonly<Record<'slim' | 'broad' | 'full', readonly ScaleEdit[]>>;
  /** Face outline: a 4-vertex cubic path, vertices in order left, bottom, right, top. */
  face: { shape: Selector };
  /** Ears follow face width changes. */
  ears: readonly Selector[];
  anchors: Readonly<Record<OverlayAnchor, AnchorBinding>>;
  /** Hand groups per side (recoloured for a prosthetic forearm). */
  hands: { left: Selector; right: Selector };
  /** Rest-pose geometry (artboard units, relative to the head anchor) overlays are drawn in. */
  head: {
    /** Face centre, half width/height of the face outline. */
    faceCenter: readonly [number, number];
    faceRadius: readonly [number, number];
    /** Eye line and brow line (y). */
    eyeY: number;
    browY: number;
    /** Ear centres (x for the right ear; the left is mirrored), y. */
    ear: readonly [number, number];
  };
}

export interface ResolvedComponent {
  index: number;
  component: RivObject;
}

/** Index of every component of the artboard, with name/ancestor lookups. */
export class RigIndex {
  readonly components: RivObject[];
  constructor(bytes: Uint8Array, artboard: string) {
    this.components = artboardSection(bytes, artboard).components;
  }
  name(index: number) {
    return componentName(this.components[index]).trim();
  }
  parent(index: number) {
    return index === 0 ? undefined : (componentParent(this.components[index]) ?? 0);
  }
  ancestors(index: number) {
    const out: number[] = [];
    for (let i = this.parent(index); i !== undefined && out.length < 64; i = this.parent(i))
      out.push(i);
    return out;
  }
  /** Components named `selector.name` (inside `selector.under` when given). */
  select(selector: Selector): number[] {
    const out: number[] = [];
    this.components.forEach((_, index) => {
      if (this.name(index) !== selector.name) return;
      if (selector.under && !this.ancestors(index).some((a) => this.name(a) === selector.under))
        return;
      out.push(index);
    });
    return out;
  }
  /** Fill colours (solid fills and gradient stops) inside the selected shapes or groups. */
  colorsOf(selector: Selector): number[] {
    const selected = new Set(this.select(selector));
    const out: number[] = [];
    const stopCount = new Map<number, number>();
    this.components.forEach((component, index) => {
      if (component.typeKey !== TYPE.solidColor && component.typeKey !== TYPE.gradientStop) return;
      if (!this.ancestors(index).some((a) => selected.has(a))) return;
      if (component.typeKey === TYPE.gradientStop) {
        const gradient = this.parent(index) ?? -1;
        const order = stopCount.get(gradient) ?? 0;
        stopCount.set(gradient, order + 1);
        if (selector.stop !== undefined && selector.stop !== order) return;
      }
      out.push(index);
    });
    return out;
  }
}

export interface ResolvedRig {
  colors: Record<ColorRole, number[]>;
  hairShapes: number[];
  hairColors: number[];
  browColors: number[];
}

/** Resolves selectors to component indices; every selector must match something. */
export function resolveRig(rig: VariantRig, index: RigIndex): ResolvedRig {
  const need = (selector: Selector, found: number[]) => {
    if (!found.length && !selector.optional)
      throw new Error(
        `${rig.character} variant rig: nothing matches ${selector.name}` +
          (selector.under ? ` under ${selector.under}` : ''),
      );
    return found;
  };
  const colors = {} as Record<ColorRole, number[]>;
  for (const [role, selectors] of Object.entries(rig.colors) as [ColorRole, Selector[]][])
    colors[role] = selectors.flatMap((s) => need(s, index.colorsOf(s)));
  const hairShapes = rig.hair.shapes.flatMap((s) => need(s, index.select(s)));
  return {
    colors,
    hairShapes,
    hairColors: rig.hair.shapes.flatMap((s) => index.colorsOf(s)),
    browColors: rig.hair.brows.flatMap((s) => need(s, index.colorsOf(s))),
  };
}
