// Renderer adapter contract. A CharacterRenderer turns abstract frames (manifest track handles,
// input handles, node handles) into pixels. Rive is the first implementation; others plug in here.
import type { CharacterManifest } from './characters/manifest';

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
): Promise<CharacterRenderer> {
  // Add new renderer kinds here as manifest.renderer grows beyond 'rive'.
  const module = await import('./rive/riveRenderer');
  return module.createRiveRenderer(canvas, manifest);
}
