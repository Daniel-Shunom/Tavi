import type { Rect } from './choreography';

/** Scene-local layout only: viewport scroll and animated CSS transforms do not enter the pose. */
export function sceneLayoutRect(
  element: HTMLElement | null,
  scene: HTMLElement | null,
): Rect | null {
  if (!element || !scene) return null;
  let left = 0,
    top = 0,
    node: HTMLElement | null = element;
  while (node && node !== scene) {
    left += node.offsetLeft;
    top += node.offsetTop;
    node = node.offsetParent as HTMLElement | null;
  }
  if (node !== scene) return null;
  return { left, top, width: element.offsetWidth, height: element.offsetHeight };
}
