import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// The new Studio's visual system, enforced. Sizes, gaps, shapes and type settings are written
// once, as tokens on `.sn`, and every other rule in the stylesheet must use them. A rule that
// writes its own number fails here, which is what keeps screens built months apart consistent.

const css = readFileSync(new URL('../../src/studio-next/studio-next.css', import.meta.url), 'utf8');

type Declaration = { selector: string; prop: string; value: string; block: number };

/** Every declaration in the file, with the selector of the rule it sits in. */
function declarations(source: string): Declaration[] {
  const found: Declaration[] = [];
  const text = source.replace(/\/\*[\s\S]*?\*\//g, '');
  let block = 0;
  for (const rule of text.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    block += 1;
    const selector = (rule[1] ?? '').trim();
    if (selector.startsWith('@keyframes') || /^(from|to|\d+%)/.test(selector)) continue;
    for (const part of (rule[2] ?? '').split(';')) {
      const at = part.indexOf(':');
      if (at < 0) continue;
      found.push({
        selector,
        prop: part.slice(0, at).trim(),
        value: part.slice(at + 1).trim(),
        block,
      });
    }
  }
  return found;
}

const all = declarations(css);
// The token definitions themselves are the one place numbers are written.
const rules = all.filter((d) => !d.prop.startsWith('--'));
const problems = (test: (d: Declaration) => string | null) =>
  rules.flatMap((d) => {
    const problem = test(d);
    return problem ? [`${d.selector} { ${d.prop}: ${d.value} } ${problem}`] : [];
  });

// Room props scale with the stage, so they are measured in container units, not the grid.
const scales = (value: string) => value.includes('cqw');
const rawPx = /-?\d*\.?\d+px/;
const roles = ['display', 'title', 'heading', 'subhead', 'body', 'small', 'micro'];
const sizeToken = new Set(roles.map((name) => `var(--sn-fs-${name})`));
const lineToken = new Set(roles.map((name) => `var(--sn-lh-${name})`));

describe('Studio visual system', () => {
  it('defines the tokens: type roles on the 4px grid, nine spacing steps, five shapes', () => {
    const token = (name: string) => all.find((d) => d.prop === name)?.value;
    for (const name of roles) {
      expect(token(`--sn-fs-${name}`), name).toMatch(/^\d+px$/);
      // A whole pixel value, more than nothing, on the 4px grid.
      const line = token(`--sn-lh-${name}`) ?? '';
      expect(line, `${name} line height`).toMatch(/^[1-9]\d*px$/);
      expect(Number(line.slice(0, -2)) % 4, `${name} line height`).toBe(0);
    }
    expect(
      ['s1', 's2', 's3', 's4', 's5', 's6', 's8', 's10', 's12'].map((step) => token(`--sn-${step}`)),
    ).toEqual(['4px', '8px', '12px', '16px', '20px', '24px', '32px', '40px', '48px']);
    expect(['sm', 'md', 'lg', 'xl', 'pill'].map((size) => token(`--sn-r-${size}`))).toEqual([
      '8px',
      '12px',
      '16px',
      '20px',
      '999px',
    ]);
  });

  it('spaces everything with spacing tokens', () => {
    expect(
      problems((d) =>
        /^(gap|row-gap|column-gap|padding|margin)(-|$)/.test(d.prop) &&
        !scales(d.value) &&
        rawPx.test(d.value)
          ? 'writes its own spacing'
          : null,
      ),
    ).toEqual([]);
  });

  it('rounds every corner with a shape token', () => {
    expect(
      problems((d) =>
        /^border(-\w+-\w+)?-radius$/.test(d.prop) && rawPx.test(d.value)
          ? 'writes its own radius'
          : null,
      ),
    ).toEqual([]);
  });

  it('sets type only through the seven roles and two families', () => {
    expect(
      problems((d) => {
        if (d.prop === 'font' && d.value !== 'inherit') return 'uses the font shorthand';
        if (d.prop === 'font-size' && !sizeToken.has(d.value)) return 'writes its own size';
        if (d.prop === 'line-height' && !lineToken.has(d.value))
          return 'writes its own line height';
        if (d.prop === 'font-family' && !/^var\(--sn-font-(display|text)\)$/.test(d.value))
          return 'names a font';
        if (d.prop === 'font-weight' && !['400', '500', '600'].includes(d.value))
          return 'uses a weight outside 400, 500, 600';
        return null;
      }),
    ).toEqual([]);
  });

  it('gives a size and its line height together, from the same role', () => {
    // Each rule block is checked by itself, so an override inside a media query cannot lean on
    // the base rule for its other half.
    const byBlock = new Map<number, Declaration[]>();
    for (const d of rules) byBlock.set(d.block, [...(byBlock.get(d.block) ?? []), d]);
    const mismatched: string[] = [];
    for (const list of byBlock.values()) {
      const selector = list[0]?.selector ?? '';
      const size = list.find((d) => d.prop === 'font-size')?.value.match(/--sn-fs-(\w+)/)?.[1];
      const line = list.find((d) => d.prop === 'line-height')?.value.match(/--sn-lh-(\w+)/)?.[1];
      if ((size || line) && size !== line)
        mismatched.push(`${selector}: ${String(size)} / ${String(line)}`);
    }
    expect(mismatched).toEqual([]);
  });

  it('keeps every other size on the 4px grid', () => {
    expect(
      problems((d) => {
        if (!/^(min-|max-)?(width|height)$/.test(d.prop) || scales(d.value)) return null;
        const off = [...d.value.matchAll(/(-?\d*\.?\d+)px/g)]
          .map((match) => Math.abs(Number(match[1])))
          // Hairlines (threads, rules) are 1 to 3px by nature.
          .filter((px) => px > 3 && px % 4 !== 0);
        return off.length ? `is off the grid (${off.join(', ')}px)` : null;
      }),
    ).toEqual([]);
  });
});
