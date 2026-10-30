import { useEffect, useRef } from 'react';
import { paintDither, type DitherLayer } from './dither';

// The hero's dithered light, carried down the page: a soft pool on the wall behind a piece of
// section art and a faint band where it meets its surface, as the TV has on its table. It keeps
// the body in the same lit world as the hero and the closing. Painted once per size (a few
// milliseconds), never per frame. It finds the art it lights by [data-art-object] among its
// siblings and centres on it.

const LAYERS: DitherLayer[] = ['on', 'seam'];

export function ArtLight() {
  const canvases = useRef<(HTMLCanvasElement | null)[]>([]);
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = host.current;
    const art = element?.parentElement?.querySelector<HTMLElement>('[data-art-object]');
    if (!element || !art) return;
    let painted = '';
    const paint = () => {
      // Layout boxes, not transformed ones: the art may be mid-reveal.
      const top = art.offsetTop - element.offsetTop,
        left = art.offsetLeft - element.offsetLeft;
      const width = element.offsetWidth,
        height = element.offsetHeight;
      const key = `${String(width)}x${String(height)}:${String(top)},${String(left)}:${String(art.offsetHeight)}`;
      if (key === painted || !width || !height) return;
      painted = key;
      const place = {
        center: {
          x: (left + art.offsetWidth / 2) / width,
          y: (top + art.offsetHeight * 0.45) / height,
        },
        radius: { x: 0.46, y: 0.46 },
        seam: Math.min(0.97, (top + art.offsetHeight) / height),
      };
      LAYERS.forEach((layer, i) => {
        const canvas = canvases.current[i];
        if (canvas) paintDither(canvas, layer, place);
      });
    };
    const size = new ResizeObserver(paint);
    size.observe(element);
    size.observe(art);
    paint();
    return () => {
      size.disconnect();
    };
  }, []);

  return (
    <div className="art-light" ref={host} aria-hidden="true">
      {LAYERS.map((layer, i) => (
        <canvas
          key={layer}
          className={`art-light-${layer}`}
          ref={(canvas) => {
            canvases.current[i] = canvas;
          }}
        />
      ))}
    </div>
  );
}
