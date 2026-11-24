import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  countdownLine,
  daysUntil,
  easter,
  holidayDate,
  holidayInSeason,
} from '../src/studio-next/holiday/calendar';
import { roomMood, rooms } from '../src/studio-next/holiday/rooms';
import { schemes } from '../src/studio-next/themes';

const holidays = schemes.filter((scheme) => scheme.group === 'holiday');

describe('holiday dates', () => {
  it('finds Easter Sunday', () => {
    expect(easter(2025)).toEqual({ month: 4, day: 20 });
    expect(easter(2027)).toEqual({ month: 3, day: 28 });
    expect(easter(2028)).toEqual({ month: 4, day: 16 });
  });

  it('knows the fixed days, and that Harvest is a season', () => {
    expect(holidayDate('christmas', 2030)).toEqual({ month: 12, day: 25 });
    expect(holidayDate('halloween', 2030)).toEqual({ month: 10, day: 31 });
    expect(holidayDate('lunar', 2027)).toEqual({ month: 2, day: 6 });
    expect(holidayDate('harvest', 2027)).toBeNull();
  });

  it('counts whole days to the next one, rolling into next year once it has passed', () => {
    expect(daysUntil('christmas', new Date(2026, 10, 24))).toBe(31);
    expect(daysUntil('christmas', new Date(2026, 11, 25))).toBe(0);
    expect(daysUntil('christmas', new Date(2026, 11, 26))).toBe(364);
    expect(daysUntil('newyear', new Date(2026, 11, 31))).toBe(1);
    expect(daysUntil('harvest', new Date(2026, 10, 24))).toBeNull();
  });

  it('is not thrown by the time of day', () => {
    expect(daysUntil('halloween', new Date(2027, 9, 30, 23, 59))).toBe(1);
    expect(daysUntil('halloween', new Date(2027, 9, 31, 0, 1))).toBe(0);
  });

  it('says the countdown in plain words', () => {
    expect(countdownLine('Christmas', 31)).toBe('31 days to Christmas');
    expect(countdownLine('Christmas', 1)).toBe('Christmas is tomorrow');
    expect(countdownLine('Christmas', 0)).toBe('It’s Christmas today');
    expect(countdownLine('Harvest', null)).toBe('Harvest season');
  });
});

describe('holiday seasons', () => {
  const on = (year: number, month: number, day: number) =>
    holidayInSeason(new Date(year, month - 1, day));

  it('runs each season up to its day', () => {
    expect(on(2026, 12, 1)).toBe('christmas');
    expect(on(2026, 12, 25)).toBe('christmas');
    expect(on(2026, 12, 26)).toBe('christmas');
    expect(on(2026, 12, 27)).toBe('newyear');
    expect(on(2027, 1, 2)).toBe('newyear');
    expect(on(2027, 10, 15)).toBe('halloween');
    expect(on(2027, 10, 31)).toBe('halloween');
    expect(on(2027, 2, 14)).toBe('valentines');
    expect(on(2027, 3, 17)).toBe('stpatricks');
    expect(on(2027, 3, 28)).toBe('easter');
    expect(on(2027, 2, 6)).toBe('lunar');
  });

  it('makes all of November Harvest', () => {
    expect(on(2026, 11, 1)).toBe('harvest');
    expect(on(2026, 11, 24)).toBe('harvest');
    expect(on(2026, 11, 30)).toBe('harvest');
  });

  it('has no holiday for most of the year', () => {
    expect(on(2027, 1, 10)).toBeNull();
    expect(on(2027, 6, 15)).toBeNull();
    expect(on(2027, 8, 1)).toBeNull();
    expect(on(2027, 10, 14)).toBeNull();
  });

  it('gives overlapping seasons to the holiday whose day is nearer', () => {
    // Lunar New Year 2026 is 17 February: its season overlaps Valentine's Day.
    expect(on(2026, 2, 12)).toBe('valentines');
    expect(on(2026, 2, 16)).toBe('lunar');
  });
});

describe('holiday rooms', () => {
  it('has a room for every holiday theme, and only for those', () => {
    expect(Object.keys(rooms).sort()).toEqual(holidays.map((scheme) => scheme.id).sort());
  });

  it('uses only pictures that are in the art folder', () => {
    for (const [id, room] of Object.entries(rooms))
      for (const prop of room.props)
        expect(
          existsSync(new URL(`../src/studio-next/holiday/art/${prop.art}.svg`, import.meta.url)),
          `${id}: ${prop.art}`,
        ).toBe(true);
  });

  it('keeps every prop on the stage, standing props on the floor and hanging ones on threads', () => {
    for (const [id, room] of Object.entries(rooms))
      for (const prop of room.props) {
        const where = `${id}: ${prop.art}`;
        expect(prop.x, where).toBeGreaterThanOrEqual(0);
        expect(prop.x, where).toBeLessThanOrEqual(100);
        expect(prop.size, where).toBeGreaterThan(3);
        expect(prop.size, where).toBeLessThanOrEqual(28);
        if (prop.layer === 'ceiling') expect(prop.hang, where).toBeGreaterThan(0);
        else expect(prop.y, where).toBeGreaterThan(20);
        // Front props sit on the floor, near the viewer, and clear of the middle where she is.
        if (prop.layer === 'front') {
          expect(prop.y, where).toBeGreaterThanOrEqual(90);
          expect(prop.x < 30 || prop.x > 70, where).toBe(true);
        }
      }
  });

  it('gives each room depth: something at the back, something hanging, something in front', () => {
    for (const [id, room] of Object.entries(rooms))
      for (const layer of ['back', 'ceiling', 'front'] as const)
        expect(
          room.props.some((prop) => prop.layer === layer),
          `${id} ${layer}`,
        ).toBe(true);
  });

  it('cues a real quick reaction from every holiday key', () => {
    for (const room of Object.values(rooms)) {
      expect(room.key.label.length).toBeGreaterThan(2);
      expect(room.key.cue).toBeGreaterThanOrEqual(0);
      expect(room.key.cue).toBeLessThan(8);
    }
  });

  it('follows her: lit when she is here, dim in quiet mode, dark on a break or offline', () => {
    const here = { connected: true, retracted: false, quiet: false };
    expect(roomMood(here)).toBe('lit');
    expect(roomMood({ ...here, quiet: true })).toBe('dim');
    expect(roomMood({ ...here, retracted: true, quiet: true })).toBe('dark');
    expect(roomMood({ ...here, connected: false })).toBe('dark');
  });
});
