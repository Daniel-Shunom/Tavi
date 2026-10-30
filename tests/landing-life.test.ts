import { describe, expect, it } from 'vitest';
import { TaviLife, type LifeFrame, type LifeInput } from '../src/landing/life';

const still: Omit<LifeInput, 'dt'> = {
  posture: 'stand',
  roomy: true,
  exertion: 0,
  impact: 0,
  visitorActive: false,
  visitorNear: false,
};

function live(life: TaviLife, seconds: number, input: Partial<LifeInput> = {}) {
  const frames: LifeFrame[] = [];
  for (let i = 0; i < seconds * 30; i++) frames.push(life.update({ ...still, ...input, dt: 1 / 30 }));
  return frames;
}
const cues = (frames: LifeFrame[]) => [
  ...new Map(frames.filter((f) => f.cue).map((f) => [f.cue?.n, f.cue?.id])).values(),
];

describe('Tavi idle life', () => {
  it('never starts a move while she is busy travelling, jumping or acting', () => {
    const life = new TaviLife();
    const frames = live(life, 120, { posture: 'busy', exertion: 0.5 });
    expect(frames.every((f) => f.cue === null && f.pause === 0 && f.legSwing === 0)).toBe(true);
  });

  it('keeps big moves to roomy ground: no dancing on a ledge or the TV top', () => {
    const roomy = cues(live(new TaviLife(), 300));
    expect(roomy).toContain('happy-dance');
    expect(cues(live(new TaviLife(), 300, { roomy: false }))).not.toContain('happy-dance');
    expect(cues(live(new TaviLife(), 300, { posture: 'perch', roomy: false }))).not.toContain(
      'happy-dance',
    );
    expect(cues(live(new TaviLife(), 300, { posture: 'floor-sit' }))).not.toContain('happy-dance');
  });

  it('swings her legs only when perched over an edge, more as she gets bored', () => {
    const life = new TaviLife();
    const early = live(life, 3, { posture: 'perch' });
    const later = live(life, 20, { posture: 'perch' });
    expect(Math.max(...early.map((f) => f.legSwing))).toBeLessThan(0.05);
    expect(Math.max(...later.map((f) => f.legSwing))).toBeGreaterThan(0.3);
    for (const posture of ['stand', 'floor-sit'] as const)
      expect(live(new TaviLife(), 40, { posture }).every((f) => f.legSwing === 0)).toBe(true);
  });

  it('dozes off resting with nothing going on, then startles awake when the visitor stirs', () => {
    const life = new TaviLife();
    live(life, 6, { posture: 'busy', exertion: 1 });
    const resting = live(life, 120, { posture: 'perch', roomy: false });
    expect(resting.some((f) => f.dozing)).toBe(true);
    expect(resting.find((f) => f.dozing)?.legSwing ?? 1).toBeLessThan(1);
    const woken = live(life, 2, { posture: 'perch', roomy: false, visitorActive: true });
    expect(woken[0]?.dozing).toBe(false);
    expect(woken[0]?.cue?.id).toBe('startled');
  });

  it('shows off for a visitor right beside her, but never repeats a move back to back', () => {
    const frames = live(new TaviLife(), 200, { visitorNear: true });
    const played = cues(frames);
    expect(played).toContain('sassy');
    played.slice(1).forEach((id, i) => {
      expect(id).not.toBe(played[i]);
    });
    // Standing moves ask the routine to wait for them.
    expect(frames.some((f) => f.pause > 0)).toBe(true);
  });

  it('tires with exertion and big landings, and recovers resting', () => {
    const life = new TaviLife();
    life.update({ ...still, dt: 1 / 30, posture: 'busy', impact: 1 });
    live(life, 20, { posture: 'busy', exertion: 1 });
    const tired = life.energy;
    expect(tired).toBeLessThan(0.6);
    live(life, 30, { posture: 'floor-sit' });
    expect(life.energy).toBeGreaterThan(tired + 0.5);
  });
});
