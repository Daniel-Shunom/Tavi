// Pure placement maths shared by renderers and tests. `placement.y` means "floor": the
// character's soles land exactly there.
import type { Placement } from './adapter';

export interface Box {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}
/**
 * The device-pixel frame to fit the artboard into (contain, bottom-centre), shifted down so
 * the soles, drawn `soleOffset` (fraction of artboard height) above the artboard bottom,
 * land on `placement.y`.
 */
export function drawFrame(
  placement: Placement,
  ratio: number,
  artboard: Box,
  soleOffset: number,
): Box {
  const frame = {
    minX: (placement.x - placement.width / 2) * ratio,
    maxX: (placement.x + placement.width / 2) * ratio,
    minY: (placement.y - placement.height) * ratio,
    maxY: placement.y * ratio,
  };
  const artboardWidth = artboard.maxX - artboard.minX,
    artboardHeight = artboard.maxY - artboard.minY;
  const fit = Math.min(
    (frame.maxX - frame.minX) / artboardWidth,
    (frame.maxY - frame.minY) / artboardHeight,
  );
  const shift = soleOffset * artboardHeight * fit;
  return { ...frame, minY: frame.minY + shift, maxY: frame.maxY + shift };
}
/** Device-pixel y of the soles for a frame from drawFrame (contain, bottom-centre). */
export function solesY(frame: Box, artboard: Box, soleOffset: number): number {
  const artboardHeight = artboard.maxY - artboard.minY;
  const fit = Math.min(
    (frame.maxX - frame.minX) / (artboard.maxX - artboard.minX),
    (frame.maxY - frame.minY) / artboardHeight,
  );
  return frame.maxY - soleOffset * artboardHeight * fit;
}
