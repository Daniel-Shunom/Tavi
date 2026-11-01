import { expect, it } from 'vitest';
import { ChatBurstFatigue } from '../server/behavior/chatFatigue';

it('allows two busy-chat visits, then skips a random 5–10 burst episodes', () => {
  const fatigue = new ChatBurstFatigue();
  for (const seed of ['first', 'second']) {
    fatigue.update(true);
    expect(fatigue.ignoreThisBurst(seed)).toBe(false);
    fatigue.update(false);
  }
  let ignored = 0;
  for (let index = 0; index < 11; index++) {
    fatigue.update(true);
    const skip = fatigue.ignoreThisBurst(String(index));
    if (skip) ignored++;
    fatigue.update(false);
    if (!skip) break;
  }
  expect(ignored).toBeGreaterThanOrEqual(5);
  expect(ignored).toBeLessThanOrEqual(10);
});

it('counts each sustained burst only once', () => {
  const fatigue = new ChatBurstFatigue();
  fatigue.update(true);
  expect(fatigue.ignoreThisBurst('same-burst')).toBe(false);
  expect(fatigue.ignoreThisBurst('same-burst')).toBe(false);
  fatigue.update(false);
  fatigue.update(true);
  expect(fatigue.ignoreThisBurst('next-burst')).toBe(false);
});
