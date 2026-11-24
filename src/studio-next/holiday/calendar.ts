// When each holiday falls, for the countdown on a holiday theme. Pure date arithmetic on local
// calendar days; no clocks or time zones beyond "today" as the streamer's computer sees it.

export type HolidayId =
  | 'newyear'
  | 'lunar'
  | 'valentines'
  | 'stpatricks'
  | 'easter'
  | 'halloween'
  | 'harvest'
  | 'christmas';

type Day = { month: number; day: number };

const fixed: Partial<Record<HolidayId, Day>> = {
  newyear: { month: 1, day: 1 },
  valentines: { month: 2, day: 14 },
  stpatricks: { month: 3, day: 17 },
  halloween: { month: 10, day: 31 },
  christmas: { month: 12, day: 25 },
};

// Lunar New Year follows the moon, so its dates are listed. Past the list there is no countdown.
const lunar: Record<number, Day> = {
  2026: { month: 2, day: 17 },
  2027: { month: 2, day: 6 },
  2028: { month: 1, day: 26 },
  2029: { month: 2, day: 13 },
  2030: { month: 2, day: 3 },
  2031: { month: 1, day: 23 },
  2032: { month: 2, day: 11 },
};

/** Easter Sunday in the Western calendar (the anonymous Gregorian algorithm). */
export function easter(year: number): Day {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return { month, day };
}

/** The holiday's date in a year, or null where it has none (Harvest is a season, not a day). */
export function holidayDate(id: HolidayId, year: number): Day | null {
  if (id === 'easter') return easter(year);
  if (id === 'lunar') return lunar[year] ?? null;
  return fixed[id] ?? null;
}

/** Whole days from today to the holiday's next occurrence: 0 on the day itself. */
export function daysUntil(id: HolidayId, today: Date): number | null {
  const start = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  for (const year of [today.getFullYear(), today.getFullYear() + 1]) {
    const date = holidayDate(id, year);
    if (!date) continue;
    const days = Math.round((Date.UTC(year, date.month - 1, date.day) - start) / 86_400_000);
    if (days >= 0) return days;
  }
  return null;
}

/** "31 days to Christmas", "Christmas is tomorrow", "It’s Christmas today", or just the season. */
export function countdownLine(label: string, days: number | null): string {
  if (days === null) return `${label} season`;
  if (days === 0) return `It’s ${label} today`;
  if (days === 1) return `${label} is tomorrow`;
  return `${String(days)} days to ${label}`;
}

// ---- Seasons: when a holiday theme is on offer ----

/** Days before and after the day itself that each holiday's season runs. */
const seasons: Record<Exclude<HolidayId, 'harvest'>, { before: number; after: number }> = {
  newyear: { before: 5, after: 1 },
  lunar: { before: 7, after: 7 },
  valentines: { before: 7, after: 0 },
  stpatricks: { before: 7, after: 0 },
  easter: { before: 10, after: 1 },
  halloween: { before: 16, after: 0 },
  christmas: { before: 24, after: 1 },
};
export const holidayIds = [
  'newyear',
  'lunar',
  'valentines',
  'stpatricks',
  'easter',
  'halloween',
  'harvest',
  'christmas',
] as const satisfies readonly HolidayId[];

/** The holiday whose season today falls in, or null. Harvest is all of November. When two
 *  seasons overlap (Lunar New Year and Valentine's Day can), the one whose day is nearer wins. */
export function holidayInSeason(today: Date): HolidayId | null {
  const start = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  let best: { id: HolidayId; distance: number } | null = null;
  for (const id of holidayIds) {
    if (id === 'harvest') {
      if (today.getMonth() === 10 && !best) best = { id, distance: 31 };
      continue;
    }
    for (const year of [today.getFullYear() - 1, today.getFullYear(), today.getFullYear() + 1]) {
      const date = holidayDate(id, year);
      if (!date) continue;
      const days = Math.round((Date.UTC(year, date.month - 1, date.day) - start) / 86_400_000);
      const season = seasons[id];
      if (days > season.before || days < -season.after) continue;
      if (!best || Math.abs(days) < best.distance) best = { id, distance: Math.abs(days) };
    }
  }
  return best?.id ?? null;
}

export const isHolidayId = (value: unknown): value is HolidayId =>
  holidayIds.some((id) => id === value);
