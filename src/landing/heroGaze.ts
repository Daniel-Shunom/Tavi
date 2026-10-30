// Hero gaze: where Tavi looks on the landing tabletop. The eyes lead with quick saccades and smooth
// pursuit, the head joins only for larger shifts, and interest in the visitor fades when the
// pointer goes still. Pure and clock-driven, so it is deterministic under test.

export interface GazeInput {
  dt: number;
  /** Pointer and head in the same client pixels; null when the pointer left the page. */
  pointer: { x: number; y: number } | null;
  head: { x: number; y: number };
  /** On-screen body height in pixels; distances scale with it. */
  bodyPx: number;
  /** Body turn the scene asks for (-1 left .. 1 right); the head yields to it while walking. */
  facing: number;
  /** 0 standing still .. 1 full walking speed. */
  walking: number;
  /** Seconds since the pointer last moved (Infinity before it ever has). */
  idleFor: number;
  /** Something the scene wants her to look at, in client pixels; it beats the visitor. */
  focus?: { x: number; y: number } | null;
}

export interface GazeFrame {
  /** Eye offset in rig units (the `eyes` node), screen right/down positive. */
  eyes: { x: number; y: number };
  /** ctl.turn-head value, -1 left .. 1 right. */
  turnHead: number;
  /** 0 ambient .. 1 fully attending to the visitor. */
  interest: number;
  /** Pointer distance from the head in body heights (Infinity without a pointer). */
  distance: number;
}

const EYE_X = 12;
const EYE_Y = 8;
/** How far the head may turn from the body while looking (turnaround units). */
const HEAD_REACH = 0.5;
const clamp = (n: number, low = -1, high = 1) => Math.max(low, Math.min(high, n));
const follow = (rate: number, dt: number) => 1 - Math.exp(-rate * dt);

/**
 * Exact critically damped spring step: never overshoots or rings, whatever the frame time.
 * (A per-frame Euler step at this stiffness flips sign every frame below ~60 fps: a visible twitch.)
 */
function critical(state: { x: number; v: number }, target: number, omega: number, dt: number) {
  const offset = state.x - target;
  const k = state.v + omega * offset;
  const decay = Math.exp(-omega * dt);
  state.x = target + (offset + k * dt) * decay;
  state.v = (state.v - omega * k * dt) * decay;
}

/**
 * Underdamped spring for a lively head that overshoots a touch and settles. Sub-stepped so it
 * stays stable (no frame-to-frame sign flips) at any frame time the page can hand it.
 */
function bouncy(
  state: { x: number; v: number },
  target: number,
  omega: number,
  zeta: number,
  dt: number,
) {
  const steps = Math.max(1, Math.ceil(dt * 240));
  const h = dt / steps;
  for (let i = 0; i < steps; i++) {
    state.v += (omega * omega * (target - state.x) - 2 * zeta * omega * state.v) * h;
    state.x += state.v * h;
  }
}

/** Small deterministic generator so wandering never repeats in lockstep but tests stay stable. */
function lcg(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const ambient = [
  { x: 0, y: 0, weight: 3 },
  { x: 0.55, y: 0.1, weight: 1.4 },
  { x: -0.55, y: 0.1, weight: 1.4 },
  { x: 0.25, y: 0.55, weight: 1 },
  { x: -0.25, y: 0.55, weight: 1 },
  { x: 0.4, y: -0.35, weight: 0.6 },
  { x: -0.4, y: -0.35, weight: 0.6 },
];

export class HeroGaze {
  private random: () => number;
  private time = 0;
  private interest = 0;
  private fixation = { x: 0, y: 0 };
  private fixationUntil = 0;
  private eyes = { x: { x: 0, v: 0 }, y: { x: 0, v: 0 } };
  private head = { x: 0, v: 0 };
  private aim = { x: 0, y: 0 };
  private micro = { x: 0, y: 0 };
  private microAt = 0;

  constructor(seed = 11) {
    this.random = lcg(seed);
  }

  private range(low: number, high: number) {
    return low + (high - low) * this.random();
  }

  private wander() {
    const total = ambient.reduce((sum, point) => sum + point.weight, 0);
    let roll = this.random() * total;
    const point = ambient.find((candidate) => (roll -= candidate.weight) < 0) ?? { x: 0, y: 0 };
    this.fixation = { x: point.x + this.range(-0.08, 0.08), y: point.y + this.range(-0.05, 0.05) };
    this.fixationUntil = this.time + this.range(0.7, 2.2);
  }

  update(input: GazeInput): GazeFrame {
    const dt = Math.max(0, Math.min(0.05, input.dt));
    this.time += dt;
    const body = Math.max(1, input.bodyPx);
    const dx = input.pointer ? input.pointer.x - input.head.x : 0;
    const dy = input.pointer ? input.pointer.y - input.head.y : 0;
    const distance = input.pointer ? Math.hypot(dx, dy) / body : Infinity;
    // A visitor close by holds attention longer than one moving across the far side of the page.
    const patience = distance < 1.4 ? 5 : distance < 3 ? 3.2 : 2.2;
    const engaged = input.pointer !== null && input.idleFor < patience;
    const focus = input.focus ?? null;
    const attending = focus !== null || engaged;
    this.interest += ((attending ? 1 : 0) - this.interest) * follow(attending ? 7 : 1.4, dt);

    // Where the eyes want to be: the visitor, travel direction, or an ambient fixation.
    let goal: { x: number; y: number };
    const travel = { x: input.facing * 0.3, y: 0.08 };
    if (attending) {
      // Soft saturation: near the face the eyes resolve fine offsets, far away they pin to the side.
      const lx = focus ? focus.x - input.head.x : dx;
      const ly = focus ? focus.y - input.head.y : dy;
      goal = { x: Math.tanh(lx / (body * 0.9)), y: Math.tanh(ly / (body * 1.1)) };
      this.fixationUntil = this.time + this.range(0.6, 1.4);
    } else {
      if (this.time >= this.fixationUntil) this.wander();
      goal = input.walking > 0.2 ? travel : this.fixation;
    }
    // Smooth pursuit for small moves; a jump (catch-up saccade) when the target gets away.
    if (Math.hypot(goal.x - this.aim.x, goal.y - this.aim.y) > 0.22) this.aim = { ...goal };
    else {
      const k = follow(9, dt);
      this.aim = {
        x: this.aim.x + (goal.x - this.aim.x) * k,
        y: this.aim.y + (goal.y - this.aim.y) * k,
      };
    }
    if (this.time >= this.microAt) {
      this.micro = { x: this.range(-0.018, 0.018), y: this.range(-0.012, 0.012) };
      this.microAt = this.time + this.range(0.9, 2.2);
    }
    // Saccades are quick (well under 0.1 s to land) and settle without overshoot.
    for (const axis of ['x', 'y'] as const)
      critical(this.eyes[axis], clamp(this.aim[axis] + this.micro[axis]), 42, dt);

    // The head joins only once the look leaves the eyes' comfortable range, a beat behind them.
    // Travel keeps its exact turn (the head leads the body there); only the look is sprung.
    const travelHead = input.facing * 0.85;
    const lookHead = (Math.sign(goal.x) * Math.max(0, Math.abs(goal.x) - 0.12) * HEAD_REACH) / 0.88;
    const lookWeight = this.interest * (1 - 0.75 * clamp(input.walking, 0, 1));
    const offsetGoal = (lookHead - travelHead) * lookWeight;
    // The head is heavier than the eyes but playful: it swings over in about a quarter second,
    // overshoots a little and settles.
    bouncy(this.head, offsetGoal, 13, 0.55, dt);
    // The face plane turns with the head, so the eyes give back part of the head's turn.
    const eyesX = this.eyes.x.x - this.head.x * 0.35;
    return {
      eyes: { x: clamp(eyesX) * EYE_X, y: clamp(this.eyes.y.x) * EYE_Y },
      turnHead: clamp(travelHead + this.head.x),
      interest: this.interest,
      distance,
    };
  }
}
