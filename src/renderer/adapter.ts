// Renderer adapter contract. A CharacterRenderer turns abstract frames (manifest track handles,
// input handles, node handles) into pixels. Rive is the first implementation; others plug in here.
import type { CharacterManifest } from './characters/manifest';
import type { Affine, TransformSource } from './attachments/layer';
import type { CharacterAttachments } from './characters/attachmentRigs';
import type { Variant } from '../../shared/variants';

/** Colour changes baked into the character file at load (recolour on commit). */
export interface Look {
  hairColor?: string | undefined;
  outfitColor?: string | undefined;
  hideGlasses?: boolean | undefined;
  /** Character variant (skin, build, face, hair...), applied for characters with a variant rig. */
  variant?: Variant | undefined;
}
/** Draws extra layers (attachments) each frame with the artboard -> device-pixel matrix. */
export type Decorator = (view: Affine, world: TransformSource, dt: number) => void;

export interface TrackApplication {
  /** Manifest track handle, never a raw clip name. */
  track: string;
  /** Normalized clip position 0..1. */
  time: number;
  mix: number;
}
export interface NodeTransform {
  x?: number;
  y?: number;
  rotation?: number;
  scaleX?: number;
  scaleY?: number;
}
export interface RenderFrame {
  tracks: TrackApplication[];
  /** State machine input handle -> value. */
  inputs: Record<string, number | boolean>;
  /** Node handle -> additive transform. */
  nodes: Record<string, NodeTransform>;
}
export interface Placement {
  /** Bottom-centre anchor in CSS pixels. */
  x: number;
  y: number;
  width: number;
  height: number;
  /** Degrees, clockwise, around the bottom-centre anchor. */
  rotation: number;
}
export interface CharacterRenderer {
  readonly manifest: CharacterManifest;
  setAppearance(selection: Record<string, string>): void;
  /** Optional per-frame drawing of attachment layers; called after the artboard advances. */
  setDecorator?(decorator: Decorator | null): void;
  applyFrame(frame: RenderFrame): void;
  resize(width: number, height: number): void;
  draw(dt: number, placement: Placement): void;
  requestFrame(callback: (time: number) => void): number;
  cancelFrame(id: number): void;
  dispose(): void;
}
export function emptyFrame(): RenderFrame {
  return { tracks: [], inputs: {}, nodes: {} };
}
export async function createCharacterRenderer(
  canvas: HTMLCanvasElement,
  manifest: CharacterManifest,
  options: { look?: Look; attachments?: CharacterAttachments | undefined } = {},
): Promise<CharacterRenderer> {
  // Add new renderer kinds here as manifest.renderer grows beyond 'rive'.
  const module = await import('./rive/riveRenderer');
  return module.createRiveRenderer(canvas, manifest, options);
}
