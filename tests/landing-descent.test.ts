import { describe, expect, it } from 'vitest';
import {
  CHAT_BUBBLES,
  PageCompanion,
  chooseFloorEpisode,
  tempoFor,
  surfaceAt,
  type PageStation,
  type PageView,
} from '../src/landing/descent';
import {
  SEAT_DROP,
  tabletopNodes,
  tabletopTracks,
  type TabletopFrame,
} from '../src/landing/tabletop';
import type { Measures } from '../src/landing/choreography';

const measures: Measures = {
  vw: 1440,
  vh: 900,
  scrollY: 0,
  maxScroll: 2600,
  mobile: false,
  bodyPx: 220,
  cam: { left: 700, top: 300, width: 140, height: 100 },
  screen: { left: 300, top: 120, width: 300, height: 230 },
  copy: null,
  floor: null,
};
const unit = measures.bodyPx * 0.8;
const stations: PageStation[] = [
  { kind: 'perch', left: 500, right: 1000, top: 1300, tilt: 0.026, spot: 870 },
  { kind: 'perch', left: 450, right: 990, top: 2100, tilt: 0, spot: 590 },
  { kind: 'floor', left: -200, right: 1240, top: 3000, tilt: 0, spot: 800 },
];
const view = (top: number, atBottom = false): PageView => ({ top, height: 900, atBottom });

function run(actor: PageCompanion, seconds: number, at: PageView, fps = 60) {
  const frames: TabletopFrame[] = [];
  for (let i = 0; i < seconds * fps; i++) {
    const frame = actor.update(1 / fps, measures, stations, at);
    if (!frame) throw new Error('Missing frame');
    frames.push(frame);
  }
  return frames;
}

describe('landing page descent', () => {
  it('stays on the desk routine while the hero is being read', () => {
    const actor = new PageCompanion();
    const frames = run(actor, 20, view(0));
    expect(frames.every((f) => f.surface !== 'page' && f.station === 0)).toBe(true);
    expect(actor.away).toBe(false);
  });

  it('follows the visitor down, station by station, and lands where they read', () => {
    const actor = new PageCompanion();
    run(actor, 6, view(0));
    // Reading the first section: she jumps off the desk and perches on its art.
    let frames = run(actor, 4, view(800));
    expect(frames.some((f) => f.action === 'air')).toBe(true);
    let last = frames.at(-1);
    const first = stations[0];
    if (!last || !first) throw new Error('Missing frame');
    expect(last.station).toBe(1);
    expect(last.seated).toBeGreaterThan(0.99);
    expect(last.placement.x).toBeCloseTo(first.spot, 3);
    expect(last.placement.y).toBeCloseTo(surfaceAt(first, first.spot) + SEAT_DROP * unit, 3);
    // Second section, then the bottom: she walks to her spot on the floor and waves.
    run(actor, 4, view(1500));
    frames = run(actor, 12, view(2400, true));
    last = frames.at(-1);
    expect(last?.station).toBe(3);
    expect(last?.placement.x).toBeCloseTo(800, 3);
    expect(last?.placement.y).toBeCloseTo(3000, 3);
    expect(frames.some((f) => f.action === 'walk')).toBe(true);
    expect(last?.reaction).toBe(1);
  });

  it('makes one long fall when the visitor skips ahead, and never moves faster than gravity', () => {
    const actor = new PageCompanion();
    run(actor, 6, view(0));
    const frames = run(actor, 6, view(2400));
    const stationsVisited = new Set(
      frames.filter((f) => f.action === 'land').map((f) => f.station),
    );
    expect([...stationsVisited]).toEqual([3]);
    // Shadow stays on a surface at or below her.
    for (const f of frames) expect(f.ground.y).toBeGreaterThanOrEqual(f.placement.y - 1e-6);
    const air = frames.filter((f) => f.action === 'air');
    expect(Math.max(...air.map((f) => f.jump?.arms ?? 0))).toBeCloseTo(1.6, 2);
  });

  it('is back on the desk almost at once when the visitor returns to the top', () => {
    const actor = new PageCompanion();
    run(actor, 6, view(0));
    run(actor, 12, view(1500));
    const frames = run(actor, 8, view(0));
    const landed = frames.findIndex((f) => f.surface === 'desk');
    expect(landed).toBeGreaterThan(0);
    expect(frames.at(-1)?.station).toBe(0);
    expect(actor.away).toBe(false);
    // One leap straight home, not a stop at every station on the way, and quick about it.
    expect(frames.slice(0, landed).some((f) => f.station === 1)).toBe(false);
    expect(landed / 60).toBeLessThan(1.2);
  });

  it('ignores a quick scroll that comes straight back', () => {
    const actor = new PageCompanion();
    run(actor, 6, view(0));
    run(actor, 0.05, view(800));
    const frames = run(actor, 4, view(0));
    expect(frames.every((f) => f.surface !== 'page')).toBe(true);
  });

  it('greets from a perch: stands, hops, waves, then sits back down', () => {
    const actor = new PageCompanion();
    run(actor, 6, view(0));
    run(actor, 5, view(800));
    actor.greet();
    const frames = run(actor, 6, view(800));
    const waved = frames.findIndex((f) => f.reaction === 1);
    expect(waved).toBeGreaterThan(0);
    expect(frames.slice(0, waved).some((f) => f.action === 'air')).toBe(true);
    expect(frames.at(-1)?.seated).toBeGreaterThan(0.99);
  });

  it('plays each stop scene once settled: reads the chat, looks along the room, presents', () => {
    const scenes = ['chat', 'room', 'floor'] as const;
    const staged: PageStation[] = stations.map((s, i) => ({ ...s, scene: scenes[i] ?? 'floor' }));
    const actor = new PageCompanion();
    const play = (seconds: number, at: PageView) => {
      const frames: TabletopFrame[] = [];
      for (let i = 0; i < seconds * 60; i++) {
        const frame = actor.update(1 / 60, measures, staged, at);
        if (frame) frames.push(frame);
      }
      return frames;
    };
    play(6, view(0));
    let frames = play(12, view(800));
    // Bubbles only pop once she is sitting, and she looks at each in turn.
    const looks = [...new Set(frames.map((f) => f.scene?.look).filter(Boolean))];
    expect(looks).toEqual(['bubble-0', 'bubble-1', 'bubble-2']);
    expect(frames.some((f) => f.scene?.expression === 'laugh')).toBe(true);
    for (const f of frames) if (f.scene?.look) expect(f.seated).toBeGreaterThan(0.99);
    expect(actor.revealed).toBe(CHAT_BUBBLES);
    expect(frames.at(-1)?.scene?.look).toBeNull();
    frames = play(10, view(1500));
    expect([...new Set(frames.map((f) => f.scene?.look).filter(Boolean))]).toEqual([
      'dot',
      'line-end',
    ]);
    // At the bottom: present the call to action first, then hop and wave.
    frames = play(14, view(2400, true));
    const presenting = frames.findIndex((f) => (f.scene?.present ?? 0) > 0.99);
    const waving = frames.findIndex((f) => f.reaction === 1);
    expect(presenting).toBeGreaterThan(0);
    expect(waving).toBeGreaterThan(presenting);
    expect(tabletopNodes(frames[presenting] as TabletopFrame)['arm-l']?.rotation).toBeGreaterThan(
      1,
    );
    expect(frames.slice(0, presenting).every((f) => f.weight === 0 || !f.scene?.present)).toBe(
      true,
    );
  });

  it('on the floor, plays peekaboo for an interested visitor and sits when tired', () => {
    const cover = { left: 600, right: 700 };
    const floorOnly: PageStation[] = stations.map((s) =>
      s.kind === 'floor' ? { ...s, spot: 800, scene: 'floor', cover } : s,
    );
    const actor = new PageCompanion();
    const play = (seconds: number, at: PageView) => {
      const frames: TabletopFrame[] = [];
      for (let i = 0; i < seconds * 60; i++) {
        const frame = actor.update(1 / 60, measures, floorOnly, at);
        if (frame) frames.push(frame);
      }
      return frames;
    };
    play(6, view(0));
    // A visitor taking an interest: she hides behind the button and peeks out at them.
    actor.setMood({ energy: 0.8, boredom: 0.3, interest: 0.9 });
    const frames = play(40, view(2400, true));
    // Then, worn out and with nobody watching, she sits down for a while.
    actor.setMood({ energy: 0.3, boredom: 0.3, interest: 0 });
    frames.push(...play(30, view(2400, true)));
    const mid = 650,
      clearOf = 50 + measures.bodyPx * 0.3;
    // Behind the button at some point, and only ever switching depth clear of it.
    expect(frames.some((f) => f.behind && Math.abs(f.placement.x - mid) < 5)).toBe(true);
    frames.slice(1).forEach((f, i) => {
      const before = frames[i];
      if (before && f.behind !== before.behind)
        expect(Math.abs(f.placement.x - mid)).toBeGreaterThanOrEqual(clearOf - 1e-6);
    });
    expect(frames.some((f) => f.action === 'skip' || f.action === 'run')).toBe(true);
    const sitting = frames.filter((f) => f.seated > 0.99);
    expect(sitting.length).toBeGreaterThan(60);
    for (const f of sitting) {
      expect(f.seatPose).toBe('floor');
      expect(f.placement.y).toBeCloseTo(3000, 3);
      expect(tabletopTracks(f).some((t) => t.track === 'runtime.pose.floor-front')).toBe(true);
    }
    // Called away while hidden behind the button: she steps out before jumping.
    const again = new PageCompanion();
    again.setMood({ energy: 0.8, boredom: 0.3, interest: 0.9 });
    for (let i = 0; i < 6 * 60; i++) again.update(1 / 60, measures, floorOnly, view(0));
    let hidden = false;
    for (let i = 0; i < 70 * 60 && !hidden; i++) {
      const f = again.update(1 / 60, measures, floorOnly, view(2400, true));
      hidden = Boolean(f?.behind && Math.abs(f.placement.x - mid) < 5);
    }
    expect(hidden).toBe(true);
    let left = false;
    for (let i = 0; i < 20 * 60; i++) {
      const f = again.update(1 / 60, measures, floorOnly, view(1500));
      if (f?.action === 'crouch' && !left) {
        left = true;
        expect(f.behind).toBe(false);
        expect(Math.abs(f.placement.x - mid)).toBeGreaterThanOrEqual(clearOf - 1e-6);
      }
    }
    expect(left).toBe(true);
  });

  it('keeps up with a fast scroll: the same trip, played faster', () => {
    const arrival = (pace: number) => {
      const actor = new PageCompanion();
      run(actor, 6, view(0));
      for (let i = 1; i < 60 * 10; i++) {
        const frame = actor.update(1 / 60, measures, stations, { ...view(2400), pace });
        if (frame?.station === 3 && frame.action !== 'air' && frame.action !== 'crouch') return i;
      }
      return Infinity;
    };
    const gentle = arrival(0.3),
      fast = arrival(5);
    expect(fast).toBeLessThan(gentle * 0.6);
    expect(tempoFor(0)).toBe(1.6);
    expect(tempoFor(50)).toBe(4);
  });

  it('chooses floor episodes for visible reasons', () => {
    const calm = { energy: 0.8, boredom: 0.1, interest: 0 };
    expect(chooseFloorEpisode({ ...calm, interest: 0.9 }, null)).toBe('peekaboo');
    expect(chooseFloorEpisode({ ...calm, interest: 0.9 }, 'peekaboo')).not.toBe('peekaboo');
    expect(chooseFloorEpisode({ ...calm, energy: 0.3 }, null)).toBe('sit');
    expect(chooseFloorEpisode({ ...calm, boredom: 0.7 }, null)).toBe('wander');
    expect(chooseFloorEpisode(calm, null)).toBe('stay');
  });

  it('jumps straight to the station being read under reduced motion', () => {
    const actor = new PageCompanion();
    const frame = actor.update(1 / 60, measures, stations, view(1500), true);
    expect(frame?.station).toBe(2);
    expect(frame?.jump).toBeNull();
    expect(frame?.seated).toBe(1);
    expect(actor.update(1 / 60, measures, stations, view(0), true)?.surface).toBe('desk');
  });
});
