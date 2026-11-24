import { isHolidayId, type HolidayId } from './holiday/calendar';

// The new Studio's themes: seven everyday colour schemes and eight holiday ones, each with a
// dark and a light tone. Themes belong to Studio only: nothing here shows on stream.
// Kept free of React and the browser so tests can measure every pairing for contrast.

/** One tone of a scheme. Every surface in Studio reads these roles and nothing else. */
export type Palette = {
  /** The app canvas, and the inset background of fields. */
  bg: string;
  /** Cards, panels and keys. */
  panel: string;
  /** Hover, selection and tracks. */
  raised: string;
  /** Every 1px border. */
  line: string;
  text: string;
  /** Secondary copy. */
  sub: string;
  /** Hints and labels. */
  faint: string;
  /** Primary actions, selection, focus. Used as a fill, with `ink` on top. */
  accent: string;
  ink: string;
  /** The second colour: reaction-key icons, small labels, the setup chip. */
  second: string;
  good: string;
  warn: string;
  /** Optional tints for the reaction keys, repeating in fours. */
  keys?: readonly [string, string, string, string];
};

export type SchemeGroup = 'everyday' | 'holiday';
export type Motif =
  'snowflake' | 'ghost' | 'clover' | 'heart' | 'egg' | 'party' | 'lantern' | 'wheat';

export const schemes = [
  {
    id: 'honey',
    label: 'Honey',
    note: 'Warm paper and espresso',
    group: 'everyday',
    dark: {
      bg: '#1a1410',
      panel: '#241c16',
      raised: '#31261d',
      line: '#47382b',
      text: '#fbf3e8',
      sub: '#d2bfa8',
      faint: '#a8957f',
      accent: '#ffb627',
      ink: '#2a1a00',
      second: '#ff8f7d',
      good: '#9bd98a',
      warn: '#ffab9b',
    },
    light: {
      bg: '#fbf4e6',
      panel: '#fffdf8',
      raised: '#f3e7d0',
      line: '#e3d2b4',
      text: '#2a1d10',
      sub: '#5f4a33',
      faint: '#6e5a3b',
      accent: '#b83d0b',
      ink: '#ffffff',
      second: '#0c6b63',
      good: '#2a6f35',
      warn: '#ab241c',
    },
  },
  {
    id: 'sorbet',
    label: 'Sorbet',
    note: 'Raspberry and teal, from Tavi herself',
    group: 'everyday',
    dark: {
      bg: '#1a1020',
      panel: '#24162b',
      raised: '#30203a',
      line: '#44304f',
      text: '#fbf1f6',
      sub: '#cfb9c8',
      faint: '#a995a6',
      accent: '#ff6c95',
      ink: '#2a0a16',
      second: '#4fd1c5',
      good: '#6fdcae',
      warn: '#ffb38a',
    },
    light: {
      bg: '#fff4f1',
      panel: '#ffffff',
      raised: '#ffe6e6',
      line: '#f3d0d3',
      text: '#2b1420',
      sub: '#6b4a58',
      faint: '#775663',
      accent: '#cf1a55',
      ink: '#ffffff',
      second: '#0a7068',
      good: '#19704e',
      warn: '#a93c1b',
    },
  },
  {
    id: 'macaron',
    label: 'Macaron',
    note: 'Soft lilac, mint, peach and butter',
    group: 'everyday',
    dark: {
      bg: '#201c26',
      panel: '#29242f',
      raised: '#353040',
      line: '#453f52',
      text: '#f2edf6',
      sub: '#c4bbcf',
      faint: '#b0a6bd',
      accent: '#cdbcf5',
      ink: '#261c3d',
      second: '#a5e3cf',
      good: '#a5e3cf',
      warn: '#f7b7a3',
      keys: ['#3a3350', '#2c3d3a', '#44352f', '#413c2b'],
    },
    light: {
      bg: '#faf7fb',
      panel: '#ffffff',
      raised: '#f1ebf8',
      line: '#e4dcee',
      text: '#33293f',
      sub: '#62566f',
      faint: '#6f647c',
      accent: '#c9b6f5',
      ink: '#2a1f45',
      second: '#1f7262',
      good: '#27705a',
      warn: '#a94a34',
      keys: ['#ece4fd', '#d9f3e9', '#ffe6d9', '#fbf0c9'],
    },
  },
  {
    id: 'lagoon',
    label: 'Lagoon',
    note: 'Deep teal with coral and sunshine',
    group: 'everyday',
    dark: {
      bg: '#0b1a20',
      panel: '#10252d',
      raised: '#18333d',
      line: '#254652',
      text: '#ecf7f6',
      sub: '#a9c6c8',
      faint: '#8fadb0',
      accent: '#ff8a5c',
      ink: '#2b1206',
      second: '#ffd166',
      good: '#7fe0b0',
      warn: '#ffb4a8',
    },
    light: {
      bg: '#eef7f5',
      panel: '#ffffff',
      raised: '#dcefeb',
      line: '#c3ded9',
      text: '#0f2a30',
      sub: '#3f5f64',
      faint: '#4d696d',
      accent: '#bd3a13',
      ink: '#ffffff',
      second: '#7a5400',
      good: '#176e50',
      warn: '#ab2f1d',
    },
  },
  {
    id: 'arcade',
    label: 'Arcade',
    note: 'Indigo night with lime and pink',
    group: 'everyday',
    dark: {
      bg: '#14122b',
      panel: '#1c1a3a',
      raised: '#28254d',
      line: '#3a3668',
      text: '#f3f1ff',
      sub: '#b9b5dc',
      faint: '#9d98c4',
      accent: '#c6f24e',
      ink: '#1a2400',
      second: '#ff8ccb',
      good: '#5fe3c0',
      warn: '#ffb09a',
    },
    light: {
      bg: '#f3f1ff',
      panel: '#ffffff',
      raised: '#e6e2fb',
      line: '#d2ccf2',
      text: '#1b1840',
      sub: '#4a4675',
      faint: '#5c5886',
      accent: '#4b3fd6',
      ink: '#ffffff',
      second: '#b0156e',
      good: '#156f53',
      warn: '#a93619',
    },
  },
  {
    id: 'matcha',
    label: 'Matcha',
    note: 'Green tea with strawberry',
    group: 'everyday',
    dark: {
      bg: '#121a14',
      panel: '#19241c',
      raised: '#223127',
      line: '#324538',
      text: '#f0f7ee',
      sub: '#b5c9b4',
      faint: '#94aa94',
      accent: '#ff8fa3',
      ink: '#2b0a12',
      second: '#b7e36b',
      good: '#7fe0a0',
      warn: '#ffb38a',
    },
    light: {
      bg: '#f3f8ee',
      panel: '#ffffff',
      raised: '#e3efd9',
      line: '#cfe0c2',
      text: '#1a2a1c',
      sub: '#46593f',
      faint: '#566950',
      accent: '#2f6b3a',
      ink: '#ffffff',
      second: '#b01f52',
      good: '#2a6f35',
      warn: '#a93c1b',
    },
  },
  {
    id: 'soda',
    label: 'Soda',
    note: 'Midnight blue, sky and bubblegum',
    group: 'everyday',
    dark: {
      bg: '#0d1326',
      panel: '#141c36',
      raised: '#1d2848',
      line: '#2c3a63',
      text: '#eef2ff',
      sub: '#b0bbdd',
      faint: '#939fc4',
      accent: '#6cb8ff',
      ink: '#06213d',
      second: '#ff9ecb',
      good: '#7fe0b0',
      warn: '#ffb4a8',
    },
    light: {
      bg: '#f0f5ff',
      panel: '#ffffff',
      raised: '#dfe9fb',
      line: '#c8d6f2',
      text: '#101a3a',
      sub: '#40507a',
      faint: '#526088',
      accent: '#1f5fd1',
      ink: '#ffffff',
      second: '#b01f6c',
      good: '#156f53',
      warn: '#a93619',
    },
  },
  // Holidays, in calendar order. Each shows by itself during its season (holiday/calendar.ts)
  // and is not on offer the rest of the year.
  {
    id: 'newyear',
    label: 'New Year',
    note: 'Midnight, champagne gold and silver',
    group: 'holiday',
    motif: 'party',
    dark: {
      bg: '#0c0d14',
      panel: '#14151f',
      raised: '#1e202d',
      line: '#2f3244',
      text: '#f5f3ec',
      sub: '#bfc0cf',
      faint: '#9c9eb2',
      accent: '#f5cf6a',
      ink: '#2a2000',
      second: '#9ad1ff',
      good: '#7fe0b0',
      warn: '#ffb4a8',
    },
    light: {
      bg: '#f7f5ef',
      panel: '#ffffff',
      raised: '#ebe7db',
      line: '#dcd6c6',
      text: '#171823',
      sub: '#46485a',
      faint: '#5b5d70',
      accent: '#1f2440',
      ink: '#ffffff',
      second: '#7a5600',
      good: '#176e50',
      warn: '#a93619',
    },
  },
  {
    id: 'lunar',
    label: 'Lunar New Year',
    note: 'Lucky red and gold',
    group: 'holiday',
    motif: 'lantern',
    dark: {
      bg: '#1c0f0f',
      panel: '#271515',
      raised: '#351d1c',
      line: '#4d2b29',
      text: '#fdf2e6',
      sub: '#dcc0b0',
      faint: '#b79a8b',
      accent: '#ff5a4f',
      ink: '#2a0503',
      second: '#f7c948',
      good: '#9bd98a',
      warn: '#ffb38a',
    },
    light: {
      bg: '#fdf4e7',
      panel: '#fffdf8',
      raised: '#f8e4cf',
      line: '#ebcfb2',
      text: '#2b1410',
      sub: '#6a463b',
      faint: '#775247',
      accent: '#c0261c',
      ink: '#ffffff',
      second: '#8a5a00',
      good: '#2a6f35',
      warn: '#a3401a',
    },
  },
  {
    id: 'valentines',
    label: 'Valentine’s Day',
    note: 'Rose, blush and plum',
    group: 'holiday',
    motif: 'heart',
    dark: {
      bg: '#1f0f18',
      panel: '#2a1521',
      raised: '#381d2c',
      line: '#4f2b3f',
      text: '#fdf0f4',
      sub: '#d9bcc8',
      faint: '#b596a4',
      accent: '#ff7096',
      ink: '#2a0612',
      second: '#ffc2a8',
      good: '#7fe0b0',
      warn: '#ffb38a',
    },
    light: {
      bg: '#fff1f3',
      panel: '#ffffff',
      raised: '#ffe1e7',
      line: '#f5c9d3',
      text: '#2e1320',
      sub: '#6e4656',
      faint: '#7a5463',
      accent: '#c81e58',
      ink: '#ffffff',
      second: '#8f3a9c',
      good: '#19704e',
      warn: '#a93c1b',
    },
  },
  {
    id: 'stpatricks',
    label: 'St Patrick’s Day',
    note: 'Shamrock green and gold',
    group: 'holiday',
    motif: 'clover',
    dark: {
      bg: '#0d1a12',
      panel: '#13251a',
      raised: '#1b3424',
      line: '#294a35',
      text: '#f1f8ee',
      sub: '#b3ccb6',
      faint: '#8fab94',
      accent: '#4ade80',
      ink: '#06260f',
      second: '#f5c542',
      good: '#86e0b0',
      warn: '#ffb38a',
    },
    light: {
      bg: '#f1f8ee',
      panel: '#ffffff',
      raised: '#dff0d9',
      line: '#c6dfc0',
      text: '#12261a',
      sub: '#3d5a45',
      faint: '#516b58',
      accent: '#15803d',
      ink: '#ffffff',
      second: '#8a6100',
      good: '#1d6b45',
      warn: '#a9441b',
    },
  },
  {
    id: 'easter',
    label: 'Easter',
    note: 'Spring pastels: butter, lavender and mint',
    group: 'holiday',
    motif: 'egg',
    dark: {
      bg: '#191c24',
      panel: '#212530',
      raised: '#2c313f',
      line: '#3d4456',
      text: '#f3f4f8',
      sub: '#bfc5d6',
      faint: '#a0a7bb',
      accent: '#f6d860',
      ink: '#2a2200',
      second: '#b9a7f5',
      good: '#9be3b5',
      warn: '#f7b7a3',
      keys: ['#3a3350', '#2c3d3a', '#3f3a28', '#3d2f38'],
    },
    light: {
      bg: '#fbfaf3',
      panel: '#ffffff',
      raised: '#f1f0e2',
      line: '#e2e0cc',
      text: '#2c2a3a',
      sub: '#5a5870',
      faint: '#5f5d75',
      accent: '#eec83c',
      ink: '#2c2500',
      second: '#6a4fc4',
      good: '#27705a',
      warn: '#a94a34',
      keys: ['#ece4fd', '#d9f3e9', '#fbf0c9', '#ffe1ea'],
    },
  },
  {
    id: 'halloween',
    label: 'Halloween',
    note: 'Midnight purple, pumpkin and slime',
    group: 'holiday',
    motif: 'ghost',
    dark: {
      bg: '#15101c',
      panel: '#1e1728',
      raised: '#2a2037',
      line: '#3d3050',
      text: '#f6efe6',
      sub: '#c9bcd2',
      faint: '#a595b0',
      accent: '#ff8a1f',
      ink: '#2a1300',
      second: '#a3e36a',
      good: '#7fe0a0',
      warn: '#ffb4a8',
    },
    light: {
      bg: '#fbf2e6',
      panel: '#fffdf9',
      raised: '#f3e3cf',
      line: '#e4cfb3',
      text: '#24162e',
      sub: '#54425f',
      faint: '#675673',
      accent: '#c2470a',
      ink: '#ffffff',
      second: '#5b2a86',
      good: '#2a6f35',
      warn: '#ab241c',
    },
  },
  {
    id: 'harvest',
    label: 'Harvest',
    note: 'Autumn leaves, cranberry and olive',
    group: 'holiday',
    motif: 'wheat',
    dark: {
      bg: '#1a130e',
      panel: '#251b14',
      raised: '#33251b',
      line: '#4a3728',
      text: '#fbf1e4',
      sub: '#d6bea6',
      faint: '#ad957e',
      accent: '#f08a3c',
      ink: '#2a1500',
      second: '#c9d36a',
      good: '#9bd98a',
      warn: '#ffab9b',
    },
    light: {
      bg: '#faf3e7',
      panel: '#fffdf8',
      raised: '#f1e4cf',
      line: '#e0cdb0',
      text: '#2b1c10',
      sub: '#614a33',
      faint: '#705a3f',
      accent: '#a8480f',
      ink: '#ffffff',
      second: '#7a2e3b',
      good: '#4a6b1f',
      warn: '#ab241c',
    },
  },
  {
    id: 'christmas',
    label: 'Christmas',
    note: 'Pine, holly red and gold',
    group: 'holiday',
    motif: 'snowflake',
    dark: {
      bg: '#0f1b16',
      panel: '#152620',
      raised: '#1e352c',
      line: '#2d4a3e',
      text: '#f6f3ea',
      sub: '#bcd0c2',
      faint: '#93ab9c',
      accent: '#ff6b6b',
      ink: '#2a0808',
      second: '#f2c94c',
      good: '#7fe0a0',
      warn: '#ffb38a',
    },
    light: {
      bg: '#f7f3ea',
      panel: '#ffffff',
      raised: '#e8efe4',
      line: '#d3ddcd',
      text: '#16261d',
      sub: '#40584a',
      faint: '#55695c',
      accent: '#b3202a',
      ink: '#ffffff',
      second: '#1d6b45',
      good: '#226b3f',
      warn: '#a9441b',
    },
  },
] as const satisfies readonly {
  id: string;
  label: string;
  note: string;
  group: SchemeGroup;
  /** A small festive mark shown beside the wordmark (see motifs.tsx). */
  motif?: Motif;
  dark: Palette;
  light: Palette;
}[];

export const schemeGroups = [
  { id: 'everyday', label: 'Everyday' },
  { id: 'holiday', label: 'Holidays' },
] as const;

export type SchemeId = (typeof schemes)[number]['id'];
export type Tone = 'dark' | 'light';
export const toneChoices = [
  { id: 'system', label: 'Match system' },
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
] as const;
export type ToneChoice = (typeof toneChoices)[number]['id'];

export type EverydayId = Extract<(typeof schemes)[number], { group: 'everyday' }>['id'];

/** What the streamer chose: their everyday scheme and a tone. Holiday themes are not chosen from
 *  a list: the one in season shows by itself, and `declined` records the holiday the streamer
 *  swapped back out of, so only that one stays off and the next holiday still arrives. */
export type ThemeChoice = { scheme: EverydayId; tone: ToneChoice; declined?: HolidayId };
export const defaultTheme: ThemeChoice = { scheme: 'honey', tone: 'system' };

export const everyday = schemes.filter(
  (entry): entry is Extract<(typeof schemes)[number], { group: 'everyday' }> =>
    entry.group === 'everyday',
);

export function parseTheme(stored: unknown): ThemeChoice {
  if (!stored || typeof stored !== 'object') return defaultTheme;
  const value = stored as Record<string, unknown>;
  return {
    scheme: everyday.find((entry) => entry.id === value['scheme'])?.id ?? defaultTheme.scheme,
    tone: toneChoices.find((entry) => entry.id === value['tone'])?.id ?? defaultTheme.tone,
    ...(isHolidayId(value['declined']) ? { declined: value['declined'] } : {}),
  };
}

/** The scheme showing now: the holiday in season, unless the streamer swapped out of it. */
export function activeScheme(choice: ThemeChoice, season: HolidayId | null) {
  const holiday = season && choice.declined !== season ? season : null;
  return schemes.find((entry) => entry.id === (holiday ?? choice.scheme)) ?? schemes[0];
}

/** The schemes on offer now: the everyday ones, plus the holiday in season if there is one. */
export function offeredSchemes(season: HolidayId | null) {
  return schemes.filter((entry) => entry.group === 'everyday' || entry.id === season);
}

/** Picking from the list. Picking the holiday takes it back up; picking anything else during a
 *  holiday's season declines that holiday only. */
export function chooseScheme(
  choice: ThemeChoice,
  picked: SchemeId,
  season: HolidayId | null,
): ThemeChoice {
  const rest: ThemeChoice = { scheme: choice.scheme, tone: choice.tone };
  const everydayPick = everyday.find((entry) => entry.id === picked);
  if (!everydayPick) return rest;
  return { ...rest, scheme: everydayPick.id, ...(season ? { declined: season } : {}) };
}

// ---- Colour arithmetic (WCAG 2 relative luminance and contrast) ----

type Rgb = [number, number, number];
const rgb = (hex: string): Rgb => [
  parseInt(hex.slice(1, 3), 16),
  parseInt(hex.slice(3, 5), 16),
  parseInt(hex.slice(5, 7), 16),
];
export function luminance(hex: string): number {
  const [r, g, b] = rgb(hex).map((part) => {
    const c = part / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as Rgb;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/** The palette to show: the active scheme in the chosen tone, or the computer's. */
export function resolveTheme(
  choice: ThemeChoice,
  systemDark: boolean,
  season: HolidayId | null = null,
): { tone: Tone; palette: Palette } {
  const scheme = activeScheme(choice, season);
  const tone: Tone = choice.tone === 'system' ? (systemDark ? 'dark' : 'light') : choice.tone;
  return { tone, palette: scheme[tone] };
}

/** The CSS variables Studio's styles read (see src/studio.css and studio-next.css). */
export function themeVars(palette: Palette, tone: Tone): Record<string, string> {
  const [r, g, b] = rgb(palette.accent);
  const glow = `rgb(${String(r)} ${String(g)} ${String(b)} / ${tone === 'dark' ? '0.16' : '0.12'})`;
  const keys = palette.keys ?? [palette.panel, palette.panel, palette.panel, palette.panel];
  return {
    '--bg': palette.bg,
    '--panel': palette.panel,
    '--raised': palette.raised,
    '--line': palette.line,
    '--text': palette.text,
    '--sub': palette.sub,
    '--faint': palette.faint,
    '--accent': palette.accent,
    '--accent-ink': palette.ink,
    '--second': palette.second,
    '--good': palette.good,
    '--warn': palette.warn,
    '--glow': glow,
    '--shadow': tone === 'dark' ? 'rgb(0 0 0 / 0.35)' : 'rgb(40 24 20 / 0.12)',
    '--k1': keys[0],
    '--k2': keys[1],
    '--k3': keys[2],
    '--k4': keys[3],
  };
}
