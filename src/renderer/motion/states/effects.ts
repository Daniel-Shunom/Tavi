// Draws body-state effects (z z z while asleep, the floor shadow of a lying body) as DOM nodes in
// a layer outside the rotating, mirrored body, so glyphs stay upright and the shadow stays flat.
import type { FloorShadow, StateEffect } from './player';

export function drawStateEffects(
  container: HTMLElement,
  effects: readonly StateEffect[],
  floorShadow: FloorShadow | null,
  /** Normalized canvas point -> CSS pixels in the container. */
  map: (x: number, y: number) => { x: number; y: number },
  /** Normalized size -> CSS pixels (scale of the mapping). */
  scale: { x: number; y: number },
  bodyPx: number,
  /** Draw this edge (portrait previews, where the stream layout is not visible). */
  ledge: { x: number; y: number; width: number } | null = null,
) {
  let bar = container.querySelector<HTMLElement>('.state-ledge');
  if (!bar) {
    bar = document.createElement('div');
    bar.className = 'state-ledge';
    container.append(bar);
  }
  if (ledge) {
    const at = map(ledge.x, ledge.y);
    const w = ledge.width * scale.x;
    bar.style.left = `${(at.x - w / 2).toFixed(1)}px`;
    bar.style.top = `${at.y.toFixed(1)}px`;
    bar.style.width = `${w.toFixed(1)}px`;
    bar.hidden = false;
  } else bar.hidden = true;
  let shadow = container.querySelector<HTMLElement>('.state-floor-shadow');
  if (!shadow) {
    shadow = document.createElement('div');
    shadow.className = 'state-floor-shadow';
    container.append(shadow);
  }
  if (floorShadow && floorShadow.opacity > 0.001) {
    const w = floorShadow.width * scale.x,
      h = floorShadow.height * scale.y;
    const at = map(floorShadow.x, floorShadow.y);
    shadow.style.left = `${(at.x - w / 2).toFixed(1)}px`;
    shadow.style.top = `${(at.y - h / 2).toFixed(1)}px`;
    shadow.style.width = `${w.toFixed(1)}px`;
    shadow.style.height = `${h.toFixed(1)}px`;
    shadow.style.opacity = floorShadow.opacity.toFixed(3);
    shadow.hidden = false;
  } else shadow.hidden = true;
  const glyphs = [...container.querySelectorAll<HTMLElement>('.state-z')];
  for (let i = glyphs.length; i < effects.length; i++) {
    const glyph = document.createElement('span');
    glyph.className = 'state-z';
    glyph.textContent = 'z';
    container.append(glyph);
    glyphs.push(glyph);
  }
  glyphs.forEach((glyph, index) => {
    const effect = effects[index];
    if (!effect) {
      glyph.hidden = true;
      return;
    }
    glyph.hidden = false;
    const size = effect.size * bodyPx;
    glyph.style.fontSize = `${size.toFixed(1)}px`;
    const at = map(effect.x, effect.y);
    glyph.style.left = `${at.x.toFixed(1)}px`;
    glyph.style.top = `${at.y.toFixed(1)}px`;
    glyph.style.opacity = effect.opacity.toFixed(3);
    glyph.style.transform = `translate(-50%, -50%) rotate(${effect.rotation.toFixed(1)}deg)`;
  });
  container.dataset['effects'] = String(effects.length);
}
