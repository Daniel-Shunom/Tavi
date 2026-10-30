import { describe, expect, it } from 'vitest';
import {
  FAST_SCROLL,
  VisitorReactions,
  type ReactionFrame,
  type ReactionInput,
} from '../src/landing/reactions';

const calm: Omit<ReactionInput, 'dt'> = {
  pointerNear: false,
  pointerOn: false,
  departing: false,
  scrollPace: 0,
  longFallLanded: false,
  homeAgain: false,
  returned: false,
  free: true,
};

function react(r: VisitorReactions, seconds: number, input: Partial<ReactionInput> = {}) {
  const frames: ReactionFrame[] = [];
  for (let i = 0; i < Math.max(1, seconds * 30); i++)
    frames.push(r.update({ ...calm, ...input, dt: 1 / 30 }));
  return frames;
}
const first = (frames: ReactionFrame[]) => frames.find((f) => f.cue)?.cue?.id;

describe('Tavi reactions to the visitor', () => {
  it('does nothing without a cause', () => {
    const frames = react(new VisitorReactions(), 30);
    expect(frames.every((f) => f.cue === null && !f.greet)).toBe(true);
  });

  it('notices a pointer arriving with a soft smile, but not one that never left', () => {
    const r = new VisitorReactions();
    react(r, 5);
    expect(first(react(r, 0.1, { pointerNear: true }))).toBe('soft-smile');
    react(r, 2, { pointerNear: true });
    expect(react(r, 1, { pointerNear: true }).every((f) => f.cue === null)).toBe(true);
  });

  it('gets shy when the pointer rests on her, then giggles if it stays', () => {
    const r = new VisitorReactions();
    const frames = react(r, 4, { pointerNear: true, pointerOn: true });
    const ids = [...new Set(frames.map((f) => f.cue?.id).filter(Boolean))];
    expect(ids).toContain('blush');
    expect(ids).toContain('amused');
    expect(ids.indexOf('blush')).toBeLessThan(ids.indexOf('amused'));
  });

  it('startles only when the visitor scrolls fast as she sets off', () => {
    expect(
      first(react(new VisitorReactions(), 0, { departing: true, scrollPace: FAST_SCROLL * 2 })),
    ).toBe('startled');
    expect(
      first(react(new VisitorReactions(), 0, { departing: true, scrollPace: FAST_SCROLL / 2 })),
    ).toBeUndefined();
  });

  it('is proud of a long drop and excited to be home again', () => {
    expect(first(react(new VisitorReactions(), 0, { longFallLanded: true }))).toBe('proud');
    expect(first(react(new VisitorReactions(), 0, { homeAgain: true }))).toBe('excited');
  });

  it('greets a returning visitor once she is free to', () => {
    const r = new VisitorReactions();
    const busy = react(r, 2, { returned: true, free: false });
    expect(busy.some((f) => f.greet)).toBe(false);
    const freed = react(r, 1, { free: true });
    expect(freed.filter((f) => f.greet)).toHaveLength(1);
  });
});
