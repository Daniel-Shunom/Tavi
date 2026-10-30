// The landing page's scroll choreography (src/landing/choreography.ts): paced progress, the edge
// hold, the one-way latch onto the ledge, scene-anchored placement and the clips each stage plays.
import { describe, expect, it } from 'vitest';
import { mascotV2 } from '../src/renderer/characters/mascot-v2/manifest';
import {
  EDGE_HOLD_MS,
  ENDING,
  EXIT,
  advanceWalk,
  initialStory,
  limitWalkStep,
  ledgePoint,
  place,
  requestedEnding,
  requestedExit,
  stageExpression,
  stageTracks,
  stepStory,
  walkCyclePx,
  type Measures,
  type Story,
} from '../src/landing/choreography';

const measures: Measures = {
  vw: 1440,
  vh: 900,
  scrollY: 0,
  maxScroll: 2700,
  cam: { left: 1030, top: 380, width: 176, height: 230 },
  screen: { left: 195, top: 130, width: 1050, height: 640 },
  copy: { left: 435, top: 300, width: 570, height: 420 },
  floor: { left: 0, top: 750, width: 1440, height: 1 },
  mobile: false,
  bodyPx: 236,
};

/** Runs the story at 60 fps toward a fixed request. */
function run(story: Story, exit: number, ending: number, seconds: number, start = 0) {
  let current = story;
  let waited = false;
  const dt = 1 / 60;
  for (let i = 0; i < seconds * 60; i++) {
    const stepped = stepStory(current, { exit, ending }, start + i * dt * 1000, dt, false);
    current = stepped.story;
    waited ||= stepped.waiting;
  }
  return { story: current, waited };
}

describe('landing choreography bands', () => {
  it('covers 0..1 contiguously for the exit and the ending', () => {
    for (const bands of [EXIT, ENDING]) {
      expect(bands[0]?.from).toBe(0);
      expect(bands[bands.length - 1]?.to).toBe(1);
      for (let i = 1; i < bands.length; i++) expect(bands[i]?.from).toBe(bands[i - 1]?.to);
    }
  });

  it('asks for the climb-out while the webcam is still on screen', () => {
    expect(requestedExit(0, 900)).toBe(0);
    expect(requestedExit(460, 900)).toBe(1);
    expect(requestedExit(230, 900)).toBeCloseTo(0.5);
    expect(requestedEnding(2700, 2700, 900)).toBe(1);
    expect(requestedEnding(2700 - 360, 2700, 900)).toBe(0);
    expect(requestedEnding(0, 0, 900)).toBe(0);
  });
});

describe('paced story', () => {
  it('never jumps: a full scroll in one frame still plays the stages in order', () => {
    const seen: string[] = [];
    let story = initialStory();
    for (let i = 0; i < 60 * 12; i++) {
      story = stepStory(story, { exit: 1, ending: 0 }, i * (1000 / 60), 1 / 60, false).story;
      const stage = place(story, measures).stage;
      if (seen[seen.length - 1] !== stage) seen.push(stage);
    }
    expect(seen).toEqual([
      'idle',
      'notice',
      'crouch',
      'brace',
      'leg-over',
      'drop',
      'walk',
      'hop',
      'ledge',
    ]);
    expect(story.latched).toBe(true);
  });

  it('holds the edge once with the bubble when the visitor runs ahead', () => {
    let story = initialStory();
    // Scroll gently to the brace, then run ahead.
    story = run(story, 0.25, 0, 4).story;
    expect(place(story, measures).stage).toBe('brace');
    const ahead = run(story, 1, 0, 0.5, 4000);
    expect(ahead.waited).toBe(true);
    const brace = EXIT.find((entry) => entry.stage === 'brace');
    if (!brace) throw new Error('Brace stage is missing');
    expect(ahead.story.p).toBeLessThan(brace.to);
    expect(ahead.story.holdUntil - 4000).toBeGreaterThanOrEqual(EDGE_HOLD_MS - 20);
    // After the hold she carries on and does not hold again.
    const later = run(ahead.story, 1, 0, 12, 4500);
    expect(later.story.latched).toBe(true);
    const back = run(later.story, 0, 0, 1, 17000);
    expect(back.waited).toBe(false);
  });

  it('latches on the ledge: scrolling back up never returns her to the screen', () => {
    const { story } = run(initialStory(), 1, 0, 14);
    expect(story.latched).toBe(true);
    const back = run(story, 0, 0, 3, 14000).story;
    expect(back.p).toBe(1);
    expect(place(back, measures).stage).toBe('ledge');
  });

  it('runs the ending only once she is on the ledge and scrubs it back', () => {
    const early = run(initialStory(), 0.5, 1, 2).story;
    expect(early.q).toBe(0);
    const seated = run(initialStory(), 1, 0, 14).story;
    const end = run(seated, 1, 1, 8, 14000).story;
    expect(end.q).toBe(1);
    expect(place(end, measures).stage).toBe('present');
    const returned = run(end, 1, 0, 8, 22000).story;
    expect(returned.q).toBe(0);
    expect(place(returned, measures).stage).toBe('ledge');
  });

  it('follows the scroll instantly with reduced motion', () => {
    const story = stepStory(initialStory(), { exit: 0.6, ending: 0 }, 0, 1 / 60, true).story;
    expect(story.p).toBeCloseTo(0.6);
  });
});

describe('placement', () => {
  const at = (p: number, extra: Partial<Story> = {}) =>
    place({ ...initialStory(), p, ...extra }, measures);

  it('starts on the webcam floor, clipped to the glass, and leaves the clip when a leg goes over', () => {
    const start = at(0);
    expect(start.x).toBeCloseTo(1030 + 88);
    expect(start.y).toBeCloseTo(380 + 230 - 1);
    expect(start.clip).toEqual(measures.cam);
    expect(at(0.35).clip).toBeNull();
  });

  it('drops onto the bezel and walks it to the ledge, turning toward the walk', () => {
    const landed = at(0.7 - 0.0001);
    expect(landed.y).toBeCloseTo(130 + 640 - 1, 0);
    const walking = at(0.79);
    expect(walking.stage).toBe('walk');
    expect(walking.y).toBeCloseTo(769);
    expect(walking.facing).toBe(-1);
    expect(walking.x).toBeLessThan(1118);
    expect(walking.x).toBeGreaterThan(ledgePoint(measures).x);
  });

  it('sits on the ledge beside the copy and drops to the closing floor at the end', () => {
    const ledge = place({ ...initialStory(), p: 1, latched: true }, measures);
    expect(ledge.stage).toBe('ledge');
    expect(ledge).toMatchObject({ x: 118, y: 450, ledge: 1, clip: null });
    const floor = place({ ...initialStory(), p: 1, latched: true, q: 0.95 }, measures);
    expect(floor.stage).toBe('present');
    expect(floor.y).toBe(750);
    expect(floor.x).toBe(435 - 128);
  });

  it('keeps the ledge on the right on phones', () => {
    const phone = { ...measures, vw: 390, vh: 844, mobile: true };
    expect(ledgePoint(phone)).toEqual({ x: 390 - 96, y: 844 - 150 });
  });

  it('counts walk distance into the gait phase with a cap', () => {
    let story: Story = { ...initialStory(), lastX: 1000 };
    story = advanceWalk(story, 990, 1 / 60, 236);
    expect(story.walkPhase).toBeLessThan(0);
    const burst = advanceWalk({ ...story, lastX: 1000 }, 0, 1 / 60, 236);
    expect(burst.walkPhase - story.walkPhase).toBeCloseTo(-2.6 / 60);
  });

  it('moves the planted target opposite the root in either direction', () => {
    const size = 236;
    const scale = (size * 0.8) / 600;
    const distance = walkCyclePx(size) * 0.1;
    const right = advanceWalk({ ...initialStory(), lastX: 0 }, distance, 1, size);
    const left = advanceWalk({ ...initialStory(), lastX: 0 }, -distance, 1, size);
    // During these stance intervals the source Rive targets travel 56 units per cycle.
    expect(distance + (14 - 56 * right.walkPhase - 14) * scale).toBeCloseTo(0, 6);
    expect(-distance + (-14 - 56 * left.walkPhase + 14) * scale).toBeCloseTo(0, 6);
  });

  it('limits fast-scroll root travel to what the gait can cover', () => {
    const previous = { ...initialStory(), p: 0.73 };
    const proposed = { ...previous, p: 0.85 };
    const dt = 1 / 60;
    const limited = limitWalkStep(previous, proposed, measures, dt);
    const distance = Math.abs(place(limited, measures).x - place(previous, measures).x);
    expect(limited.p).toBeGreaterThan(previous.p);
    expect(distance).toBeLessThanOrEqual(walkCyclePx(measures.bodyPx) * 2.4 * dt);
  });
});

describe('stage tracks', () => {
  const opening = { streamStarted: true, startedAt: 0 };

  it('applies the neutral base under every stage and only known manifest handles', () => {
    for (const p of [0, 0.1, 0.17, 0.25, 0.4, 0.6, 0.8, 0.95]) {
      const tracks = stageTracks(
        place({ ...initialStory(), p }, measures),
        initialStory(),
        5000,
        opening,
      );
      expect(tracks[0]?.track).toBe('landing.rest');
      for (const track of tracks) expect(mascotV2.tracks).toHaveProperty(track.track);
    }
  });

  it('plays the panic loop before the stream starts, then relief once', () => {
    const inCam = place(initialStory(), measures);
    expect(
      stageTracks(inCam, initialStory(), 500, { streamStarted: false, startedAt: 0 }).map(
        (t) => t.track,
      ),
    ).toContain('landing.panic');
    expect(
      stageTracks(inCam, initialStory(), 500, { streamStarted: true, startedAt: 0 }).map(
        (t) => t.track,
      ),
    ).toContain('landing.relief');
    expect(
      stageTracks(inCam, initialStory(), 5000, { streamStarted: true, startedAt: 0 }).map(
        (t) => t.track,
      ),
    ).not.toContain('landing.relief');
  });

  it('adds occasional idle gestures automatically and honors reduced motion', () => {
    const inCam = place(initialStory(), measures);
    const opening = { streamStarted: true, startedAt: 1000 };
    const first = 1000 + 1200 + 6000 + 1000;
    expect(stageTracks(inCam, initialStory(), first, opening).map((t) => t.track)).toContain(
      'landing.present',
    );
    expect(
      stageTracks(inCam, initialStory(), first + 18000, opening).map((t) => t.track),
    ).toContain('landing.relief');
    expect(
      stageTracks(inCam, initialStory(), first, { ...opening, reducedMotion: true }).map(
        (t) => t.track,
      ),
    ).not.toContain('landing.present');
  });

  it('sits down on arrival, then lives on the ledge, and turns the body while walking', () => {
    const seated = { ...initialStory(), p: 1, latched: true, arrivedAt: 1000 };
    const ledge = place(seated, measures);
    expect(stageTracks(ledge, seated, 1300, opening).map((t) => t.track)).toContain(
      'landing.sit-down',
    );
    expect(stageTracks(ledge, seated, 9000, opening).map((t) => t.track)).toContain(
      'landing.sit-life',
    );
    const walking = place({ ...initialStory(), p: 0.79 }, measures);
    const names = stageTracks(walking, initialStory(), 0, opening).map((t) => t.track);
    expect(names).toContain('walk-cycle');
    expect(names).toContain('ctl.turn-body');
  });

  it('names an expression for every acted stage and leaves the ledge to the sections', () => {
    expect(stageExpression('idle', { streamStarted: false })).toBe('startled');
    expect(stageExpression('present', { streamStarted: true })).toBe('proud');
    expect(stageExpression('ledge', { streamStarted: true })).toBeNull();
  });
});
