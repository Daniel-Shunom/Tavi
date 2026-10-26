// Timing and composition only. All input remains manual or supplied by the shared service.
export type PerformanceAction =
  'listening' | 'skeptical' | 'caught' | 'nod' | 'celebrate' | 'wave' | 'tuck';
export interface PerformanceState {
  action: PerformanceAction | 'idle';
  age: number;
  duration: number;
  weight: number;
  hidden: boolean;
  scene: boolean;
}
export interface Pose {
  clips: { name: string; time: number; mix: number }[];
  rotation: number;
  x: number;
  y: number;
  scale: number;
  caption: string;
  label: string;
  tuck: number;
}
export const durations: Record<PerformanceAction, number> = {
  listening: 3.2,
  skeptical: 3.4,
  caught: 3.6,
  nod: 2.4,
  celebrate: 3,
  wave: 2.8,
  tuck: 1.6,
};
export const scene: { action: PerformanceAction | 'idle'; duration: number }[] = [
  { action: 'idle', duration: 1.2 },
  { action: 'listening', duration: 3 },
  { action: 'skeptical', duration: 3.4 },
  { action: 'idle', duration: 1.4 },
];
export const sceneDuration = scene.reduce((sum, phase) => sum + phase.duration, 0);
export function smooth(value: number) {
  const x = Math.max(0, Math.min(1, value));
  return x * x * (3 - 2 * x);
}
export function envelope(age: number, duration: number) {
  return smooth(age / 0.45) * (1 - smooth((age - duration + 0.65) / 0.65));
}
export class Director {
  action: PerformanceAction | 'idle';
  started: number;
  sceneStarted: number | null;
  hidden: boolean;
  constructor() {
    this.action = 'idle';
    this.started = 0;
    this.sceneStarted = null;
    this.hidden = false;
  }
  play(action: PerformanceAction, now: number) {
    if (!(action in durations)) throw new Error('Unknown performance: ' + action);
    this.action = action;
    this.started = now;
    this.sceneStarted = null;
    this.hidden = false;
  }
  runScene(now: number) {
    this.action = 'idle';
    this.sceneStarted = now;
    this.hidden = false;
  }
  idle() {
    this.action = 'idle';
    this.sceneStarted = null;
    this.hidden = false;
  }
  snapshot(now: number): PerformanceState {
    let action = this.action,
      age = now - this.started,
      duration = action === 'idle' ? Infinity : durations[action];
    if (this.sceneStarted !== null) {
      let remaining = Math.max(0, now - this.sceneStarted);
      let found = false;
      for (const phase of scene) {
        if (remaining < phase.duration) {
          action = phase.action;
          age = remaining;
          duration = phase.duration;
          found = true;
          break;
        }
        remaining -= phase.duration;
      }
      if (!found) {
        this.sceneStarted = null;
        this.action = 'idle';
        action = 'idle';
        age = 0;
        duration = Infinity;
      }
    } else if (action !== 'idle' && age >= duration) {
      this.hidden = action === 'tuck';
      this.action = 'idle';
      action = 'idle';
      age = 0;
      duration = Infinity;
    }
    return {
      action,
      age: Math.max(0, age),
      duration,
      weight: action === 'idle' ? 0 : envelope(age, duration),
      hidden: this.hidden,
      scene: this.sceneStarted !== null,
    };
  }
}
export function performancePose(
  state: PerformanceState,
  {
    strength = 0.7,
    attitude = 'cheeky',
    reducedMotion = false,
  }: { strength?: number; attitude?: 'gentle' | 'cheeky' | 'spicy'; reducedMotion?: boolean } = {},
): Pose {
  const level = strength * { gentle: 0.65, cheeky: 1, spicy: 1.2 }[attitude];
  const weight = Math.min(1, state.weight * level);
  const age = state.age;
  const result: Pose = {
    clips: [],
    rotation: 0,
    x: 0,
    y: 0,
    scale: 1,
    caption: '',
    label: 'Idle',
    tuck: 0,
  };
  const add = (name: string, time: number, mix = 1) =>
    result.clips.push({ name, time: Math.min(0.999, Math.max(0, time)), mix: weight * mix });
  if (state.hidden) {
    result.label = 'Tucked away';
    result.tuck = 1;
    return result;
  }
  switch (state.action) {
    case 'listening':
      add('blink 3', 0.2, 0.65);
      result.rotation = -2 * weight;
      result.scale = 1 + 0.025 * weight;
      result.label = 'Listening';
      result.caption = 'Go on...';
      break;
    case 'skeptical':
      add('thoughtful', 0.6, 0.9);
      add('hands on hips', 0.55, 0.45);
      result.rotation = 2.2 * weight;
      result.x = 5 * weight;
      result.label = 'Really?';
      result.caption =
        attitude === 'spicy'
          ? 'aiit bro, ntm'
          : attitude === 'gentle'
            ? 'Confident, huh?'
            : 'Okay, superstar.';
      break;
    case 'caught':
      add('blink 3', 0.65, 0.9);
      result.x = -16 * weight;
      result.rotation = -4 * weight;
      result.label = 'Caught me';
      result.caption = age < 1.8 ? "Wasn't me." : '...probably.';
      break;
    case 'nod':
      add('blink 2', 0.25, 0.35);
      result.y = Math.sin(age * 8) * 4 * weight;
      result.label = 'Fair enough';
      result.caption = 'Fair enough.';
      break;
    case 'celebrate':
      add('celebration', age / 2, 0.95);
      result.label = 'You did it';
      result.caption = 'There it is!';
      break;
    case 'wave':
      add('wave Non Looping', age / 2, 0.95);
      result.label = 'Say hi';
      result.caption = 'Hey, you.';
      break;
    case 'tuck':
      add('thoughtful', 0.5, 0.65);
      result.rotation = 3 * weight;
      result.tuck = smooth((age - 0.65) / 0.75);
      result.label = "Fine, I'm going";
      result.caption = "Fine. I'll be over here.";
      break;
  }
  if (reducedMotion) {
    result.rotation = 0;
    result.x = 0;
    result.y = 0;
    result.scale = 1;
  }
  return result;
}
