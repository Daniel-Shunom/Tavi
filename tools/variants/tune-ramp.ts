// Prints the skin ramp in OKLCH and a suggested shade per tone that satisfies the design-guide
// rules (darker, hue rotated toward red by 3-8 degrees, chroma >= base). Authoring aid only.
// Usage: npx tsx tools/variants/tune-ramp.ts
import { skinRamp } from '../../shared/variants';
import { fromOklch, oklch } from '../../src/renderer/characters/variants/colorScience';

for (const [tone, [base, shade, highlight]] of Object.entries(skinRamp)) {
  const b = oklch(base),
    s = oklch(shade),
    h = oklch(highlight);
  const ok = s.c >= b.c * 0.95 && s.h <= b.h + 1 && s.h > b.h - 16;
  const suggestion = fromOklch({ l: s.l, c: Math.max(s.c, b.c * 1.04), h: Math.min(s.h, b.h - 4) });
  console.log(
    tone.padStart(2),
    `base ${base} L${b.l.toFixed(3)} C${b.c.toFixed(3)} h${b.h.toFixed(1)}`,
    `| shade ${shade} L${s.l.toFixed(3)} C${s.c.toFixed(3)} h${s.h.toFixed(1)} ${ok ? 'ok' : '-> ' + suggestion}`,
    `| hl ${highlight} C${h.c.toFixed(3)} h${h.h.toFixed(1)}`,
  );
}
