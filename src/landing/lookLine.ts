// The look line: a fine hairline that draws itself from Tavi's eyes to whatever her scene has her
// looking at (a chat message, the room's attention dot, the call to action), then fades when she
// looks away. It makes "knows where to look" something visitors can see. Client pixels.

export interface Point {
  x: number;
  y: number;
}

/** Matches --ease-out and --dur-scene in landing.css. */
const EASE_OUT = 'cubic-bezier(0.23, 1, 0.32, 1)';
const DRAW_MS = 900;

/** The path from just off her face to just short of the target, bowed gently upward. */
export function lookPath(from: Point, to: Point, face: number) {
  const dx = to.x - from.x,
    dy = to.y - from.y;
  const length = Math.hypot(dx, dy) || 1;
  const ux = dx / length,
    uy = dy / length;
  const start = { x: from.x + ux * face, y: from.y + uy * face };
  const end = { x: to.x - ux * 7, y: to.y - uy * 7 };
  // Bow to whichever side is up, by a small share of the length.
  const side = -ux < 0 ? 1 : -1;
  const bow = Math.min(length * 0.08, 40);
  const control = {
    x: (start.x + end.x) / 2 + uy * bow * side,
    y: (start.y + end.y) / 2 - Math.abs(ux) * bow,
  };
  return { start, end, control };
}

export class LookLine {
  private target: string | null = null;
  private readonly path: SVGPathElement | null;
  private readonly ring: SVGCircleElement | null;
  private readonly fade: SVGLinearGradientElement | null;

  constructor(private readonly svg: SVGSVGElement) {
    this.path = svg.querySelector('path');
    this.ring = svg.querySelector('circle');
    this.fade = svg.querySelector('linearGradient');
  }

  /** Call every frame. `look` names the target; null (or no geometry) lets the line fade out. */
  update(look: string | null, from: Point | null, to: Point | null, face: number) {
    const { path, ring, fade } = this;
    if (!path || !ring || !fade) return;
    const showing = look !== null && from !== null && to !== null;
    this.svg.dataset['showing'] = String(showing);
    if (!showing) {
      this.target = null;
      return;
    }
    const { start, end, control } = lookPath(from, to, face);
    path.setAttribute(
      'd',
      `M${start.x.toFixed(1)} ${start.y.toFixed(1)}Q${control.x.toFixed(1)} ${control.y.toFixed(1)} ${end.x.toFixed(1)} ${end.y.toFixed(1)}`,
    );
    ring.setAttribute('cx', to.x.toFixed(1));
    ring.setAttribute('cy', to.y.toFixed(1));
    fade.setAttribute('x1', start.x.toFixed(1));
    fade.setAttribute('y1', start.y.toFixed(1));
    fade.setAttribute('x2', end.x.toFixed(1));
    fade.setAttribute('y2', end.y.toFixed(1));
    if (look === this.target) return;
    // A new target: the line draws out from her eyes, then the ring settles on it.
    this.target = look;
    path.animate([{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], {
      duration: DRAW_MS,
      easing: EASE_OUT,
      fill: 'both',
    });
    ring.animate(
      [
        { opacity: 0, transform: 'scale(0.6)' },
        { opacity: 1, transform: 'scale(1)' },
      ],
      { duration: 600, delay: DRAW_MS * 0.55, easing: EASE_OUT, fill: 'both' },
    );
  }
}
