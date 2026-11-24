import { describe, expect, it } from 'vitest';
import {
  activeScheme,
  chooseScheme,
  contrast,
  defaultTheme,
  offeredSchemes,
  parseTheme,
  resolveTheme,
  schemes,
  themeVars,
  type Palette,
} from '../../src/studio-next/themes';

// Every pairing Studio actually draws, measured. Body text needs 4.5:1 (WCAG AA).
function check(name: string, palette: Palette) {
  const surfaces = [palette.bg, palette.panel, palette.raised, ...(palette.keys ?? [])];
  const problems: string[] = [];
  const need = (what: string, a: string, b: string, min: number) => {
    const ratio = contrast(a, b);
    if (ratio < min)
      problems.push(`${name}: ${what} ${a} on ${b} is ${ratio.toFixed(2)}, needs ${String(min)}`);
  };
  for (const surface of surfaces) {
    need('text', palette.text, surface, 4.5);
    need('soft text', palette.sub, surface, 4.5);
    need('hint', palette.faint, surface, 4.5);
    // Reaction-key icons and small labels.
    need('second colour', palette.second, surface, 4.5);
  }
  need('ink on accent', palette.ink, palette.accent, 4.5);
  // The setup chip: the canvas colour as text on a second-colour fill.
  need('canvas on second colour', palette.bg, palette.second, 4.5);
  for (const surface of [palette.bg, palette.panel]) {
    need('good', palette.good, surface, 4.5);
    need('warning', palette.warn, surface, 4.5);
  }
  // Selection rings and the switch must be findable against a panel.
  need('accent against panel', palette.accent, palette.panel, 1.5);
  return problems;
}

describe('Studio themes', () => {
  it('has Honey as the default, matching the system tone', () => {
    expect(defaultTheme).toEqual({ scheme: 'honey', tone: 'system' });
    expect(schemes[0].id).toBe('honey');
  });

  it('offers seven everyday schemes and eight holiday ones', () => {
    const ids = (group: string) =>
      schemes.filter((scheme) => scheme.group === group).map((scheme) => scheme.id);
    expect(ids('everyday')).toEqual([
      'honey',
      'sorbet',
      'macaron',
      'lagoon',
      'arcade',
      'matcha',
      'soda',
    ]);
    expect(ids('holiday')).toEqual([
      'newyear',
      'lunar',
      'valentines',
      'stpatricks',
      'easter',
      'halloween',
      'harvest',
      'christmas',
    ]);
  });

  it('gives every holiday a festive mark, and no everyday scheme one', () => {
    for (const scheme of schemes)
      expect('motif' in scheme, scheme.id).toBe(scheme.group === 'holiday');
  });

  it('keeps every text and icon pairing readable in every scheme and tone', () => {
    const problems = schemes.flatMap((scheme) => [
      ...check(`${scheme.label} dark`, scheme.dark),
      ...check(`${scheme.label} light`, scheme.light),
    ]);
    expect(problems).toEqual([]);
  });

  it('keeps dark tones dark and light tones light', () => {
    for (const scheme of schemes) {
      expect(contrast(scheme.dark.bg, '#000000')).toBeLessThan(1.6);
      expect(contrast(scheme.light.bg, '#ffffff')).toBeLessThan(1.2);
    }
  });

  it('follows the system when asked, and the choice otherwise', () => {
    expect(resolveTheme({ scheme: 'honey', tone: 'system' }, true).tone).toBe('dark');
    expect(resolveTheme({ scheme: 'honey', tone: 'system' }, false).tone).toBe('light');
    expect(resolveTheme({ scheme: 'honey', tone: 'light' }, true).tone).toBe('light');
  });

  it('reads a saved choice, ignoring anything it does not recognise', () => {
    expect(parseTheme(null)).toEqual(defaultTheme);
    expect(parseTheme({ scheme: 'neon', tone: 'sideways', declined: 'birthday' })).toEqual(
      defaultTheme,
    );
    expect(parseTheme({ scheme: 'soda', tone: 'dark', declined: 'halloween' })).toEqual({
      scheme: 'soda',
      tone: 'dark',
      declined: 'halloween',
    });
    // A holiday is never the streamer's everyday scheme.
    expect(parseTheme({ scheme: 'christmas', tone: 'dark' })).toEqual({
      scheme: 'honey',
      tone: 'dark',
    });
  });

  it('shows the holiday in season by itself, and the everyday scheme the rest of the year', () => {
    const choice = { scheme: 'soda', tone: 'dark' } as const;
    expect(activeScheme(choice, null).id).toBe('soda');
    expect(activeScheme(choice, 'halloween').id).toBe('halloween');
    expect(resolveTheme(choice, true, 'halloween').palette).toBe(
      schemes.find((scheme) => scheme.id === 'halloween')?.dark,
    );
  });

  it('offers only the holiday in season, never the others', () => {
    const ids = (season: Parameters<typeof offeredSchemes>[0]) =>
      offeredSchemes(season).map((scheme) => scheme.id);
    expect(ids(null)).toEqual(['honey', 'sorbet', 'macaron', 'lagoon', 'arcade', 'matcha', 'soda']);
    expect(ids('christmas')).toEqual([...ids(null), 'christmas']);
  });

  it('lets the streamer swap out of one holiday without losing the next', () => {
    const start = { scheme: 'honey', tone: 'system' } as const;
    const swapped = chooseScheme(start, 'lagoon', 'halloween');
    expect(swapped).toEqual({ scheme: 'lagoon', tone: 'system', declined: 'halloween' });
    expect(activeScheme(swapped, 'halloween').id).toBe('lagoon');
    // The next holiday still arrives.
    expect(activeScheme(swapped, 'christmas').id).toBe('christmas');
    // Picking the holiday again takes it back up and keeps their everyday scheme.
    const back = chooseScheme(swapped, 'halloween', 'halloween');
    expect(back).toEqual({ scheme: 'lagoon', tone: 'system' });
    expect(activeScheme(back, 'halloween').id).toBe('halloween');
    // Out of season, picking a scheme declines nothing.
    expect(chooseScheme(start, 'soda', null)).toEqual({ scheme: 'soda', tone: 'system' });
  });

  it('gives Studio every variable its styles read', () => {
    const vars = themeVars(schemes[0].dark, 'dark');
    for (const name of ['--bg', '--panel', '--raised', '--line', '--text', '--sub', '--faint'])
      expect(vars[name]).toMatch(/^#[0-9a-f]{6}$/);
    expect(vars['--accent-ink']).toBe(schemes[0].dark.ink);
    expect(vars['--k1']).toBe(schemes[0].dark.panel);
    expect(Object.keys(vars).every((name) => name.startsWith('--'))).toBe(true);
  });
});
