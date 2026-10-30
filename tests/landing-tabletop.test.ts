import { describe, expect, it } from 'vitest';
import {
  GAITS,
  TV_TOP,
  CHASE_SPEED,
  IDLE_VISITOR,
  TabletopCompanion,
  tabletopTracks,
  tabletopNodes,
  type TabletopFrame,
  type Visitor,
} from '../src/landing/tabletop';
import type { Measures } from '../src/landing/choreography';

const measures: Measures = {
  vw: 1440,
  vh: 900,
  scrollY: 0,
  maxScroll: 2600,
  mobile: false,
  bodyPx: 236,
  cam: { left: 700, top: 300, width: 140, height: 100 },
  screen: { left: 420, top: 220, width: 500, height: 380 },
  copy: null,
  floor: null,
};
const screen = measures.screen ?? { left: 0, top: 0, width: 1, height: 1 };
const scale = screen.width / (0.1263319 + 0.2571352);
const pxPerY = screen.height / (0.4042329 - 0.1141471);
const unit = measures.bodyPx * 0.8;
const deskY = screen.top + ((0.4042329 + 0.001) / (0.4042329 - 0.1141471)) * screen.height;
const tvY = deskY - TV_TOP * pxPerY;
const worldX = (frame: TabletopFrame) => (frame.placement.x - screen.left) / scale - 0.2571352;
const fastest = Math.max(
  ...Object.values(GAITS).map((g) => (g.stride / 600) * unit * g.cycles),
);
const quiet: Visitor = { x: null, y: null, speed: 0, idleFor: 0 };

function simulate(seconds: number, fps: number, visitor = quiet, actor = new TabletopCompanion()) {
  const frames: TabletopFrame[] = [];
  for (let i = 0; i < seconds * fps; i++) {
    const frame = actor.update(1 / fps, measures, false, visitor);
    if (!frame) throw new Error('Missing tabletop frame');
    frames.push(frame);
  }
  return { actor, frames };
}

describe('landing tabletop companion', () => {
  it.each([30, 60, 144])('runs a grounded, distance-locked routine at %i fps', (fps) => {
    const { frames } = simulate(150, fps);
    const actions = new Set(frames.map((f) => f.action));
    const depths = new Set(frames.map((f) => f.depth));
    let previous = frames[0];
    // Launch speed of the highest jump: the fastest any frame may rise or fall.
    const launch = Math.sqrt(2 * 3.2 * (TV_TOP + 0.05)) * pxPerY;
    for (const frame of frames.slice(1)) {
      if (!previous) break;
      const moved = Math.abs(frame.placement.x - previous.placement.x);
      if (!frame.jump && !previous.jump) {
        expect(moved).toBeLessThanOrEqual(fastest / fps + 0.001);
        if (moved > 0.001 && frame.gaits.length === 1 && previous.gaits.length === 1) {
          const gait = frame.gaits[0];
          const before = previous.gaits[0];
          if (gait && before && gait.foundation === before.foundation) {
            const phase = (gait.phase - before.phase + 1) % 1;
            const stride = (({ walk: 60, sprint: 104, skip: 160 })[gait.foundation] / 600) * unit;
            expect(phase * stride).toBeCloseTo(moved, 4);
          }
        }
      }
      if (frame.seated === 0 && previous.seated === 0)
        expect(Math.abs(frame.placement.y - previous.placement.y)).toBeLessThan(launch / fps + 1);
      if (frame.depth !== previous.depth) expect(Math.abs(worldX(frame))).toBeGreaterThan(0.35);
      // Feet never sink below the surface she stands on.
      expect(frame.placement.y - frame.seated * (114.218 / 600) * unit).toBeLessThanOrEqual(
        frame.ground.y + 0.5,
      );
      const tracks = tabletopTracks(frame);
      expect(tracks.every((t) => !t.track.startsWith('landing.'))).toBe(true);
      if (frame.seated > 0) expect(tabletopNodes(frame)['runtime-mode']?.x).toBe(6);
      if (frame.jump) expect(tracks.some((t) => t.track === 'runtime.arms-front')).toBe(true);
      previous = frame;
    }
    for (const action of ['sit', 'walk', 'run', 'sprint', 'skip', 'crouch', 'air', 'land'])
      expect(actions.has(action as TabletopFrame['action']), action).toBe(true);
    expect(depths).toEqual(new Set(['front', 'back']));
  });

  it('jumps onto the TV, sits on its top edge, and jumps back down', () => {
    const { frames } = simulate(150, 60);
    const onTv = frames.filter((f) => f.surface === 'tv' && f.seated > 0.99);
    expect(onTv.length).toBeGreaterThan(60 * 5);
    for (const frame of onTv) {
      expect(Math.abs(worldX(frame))).toBeLessThan(0.3);
      expect(frame.depth).toBe('front');
      expect(frame.placement.y).toBeCloseTo(tvY + (114.218 / 600) * unit * frame.seated, 3);
      expect(tabletopTracks(frame).some((t) => t.track === 'runtime.pose.perch-front')).toBe(true);
    }
    const peak = Math.min(...frames.map((f) => f.placement.y));
    expect(peak).toBeLessThan(tvY - 10);
    const last = frames.map((f) => f.surface).lastIndexOf('tv');
    expect(frames.slice(last + 1).some((f) => f.surface === 'desk' && f.action === 'land')).toBe(
      true,
    );
  });

  it('crossfades gaits without exceeding the locomotion weight', () => {
    const frame = simulate(1, 60).frames.at(-1);
    if (!frame) throw new Error('Missing frame');
    const mixed: TabletopFrame = {
      ...frame,
      weight: 0.8,
      gaits: [
        { foundation: 'walk', phase: 0.1, mix: 0.25 },
        { foundation: 'sprint', phase: 0.4, mix: 0.75 },
      ],
    };
    const tracks = tabletopTracks(mixed).filter((t) => t.track.startsWith('runtime.gait.'));
    // Sequential blending: the first track's share is what survives the later one.
    const [a, b] = tracks.map((t) => t.mix);
    expect((a ?? 0) * (1 - (b ?? 0))).toBeCloseTo(0.8 * 0.25, 6);
    expect(b).toBeCloseTo(0.8 * 0.75, 6);
  });

  it('chases a fast pointer sweep along the desk, then settles and carries on', () => {
    const actor = new TabletopCompanion();
    // Free on the desk, mid-run, away from the pointer.
    simulate(8, 60, quiet, actor);
    const sweep: Visitor = { x: -0.3, y: 0.1, speed: CHASE_SPEED * 3, idleFor: 0 };
    const { frames } = simulate(16, 60, sweep, actor);
    expect(frames.some((f) => f.action === 'sprint' || f.action === 'run')).toBe(true);
    const caught = frames.at(-1);
    expect(caught ? worldX(caught) : 0).toBeCloseTo(-0.3, 2);
    const after = simulate(12, 60, { ...sweep, speed: 0, idleFor: 1 }, actor).frames;
    expect(after.some((f) => f.weight > 0.5)).toBe(true);
  });

  it('takes an idle visitor up to sit on the TV', () => {
    const idle: Visitor = { x: null, y: null, speed: 0, idleFor: IDLE_VISITOR + 1 };
    const { frames } = simulate(60, 60, idle);
    expect(frames.some((f) => f.surface === 'tv' && f.seated > 0.99)).toBe(true);
  });

  it('greets with a hop, then waves once braked and facing the visitor', () => {
    const actor = new TabletopCompanion();
    simulate(10, 60, quiet, actor);
    actor.greet();
    let hopped = false,
      greeted = false;
    for (let i = 0; i < 400 && !greeted; i++) {
      const frame = actor.update(1 / 60, measures, false, quiet);
      if (frame?.action === 'air') hopped = true;
      if (frame?.reaction) {
        expect(hopped).toBe(true);
        expect(frame.weight).toBeLessThan(0.03);
        expect(frame.seated).toBe(0);
        expect(Math.abs(frame.placement.facing)).toBeLessThan(0.03);
        greeted = true;
      }
    }
    expect(greeted).toBe(true);
  });

  it('stays attached to the table when the page scrolls', () => {
    const actor = new TabletopCompanion();
    const before = actor.update(0, measures);
    const after = actor.update(0, {
      ...measures,
      scrollY: 800,
      screen: { ...screen, top: screen.top - 800 },
    });
    expect((after?.placement.y ?? 0) - (before?.placement.y ?? 0)).toBeCloseTo(-800);
    expect(after?.placement.x).toBe(before?.placement.x);
  });

  it('keeps the route still under reduced motion', () => {
    const actor = new TabletopCompanion();
    const first = actor.update(0, measures, true);
    for (let i = 0; i < 600; i++) expect(actor.update(1 / 60, measures, true)).toEqual(first);
  });
});
