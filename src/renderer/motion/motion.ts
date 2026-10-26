// MotionLayer: composes idle life, gaze, blinks, fidgets, expressions, locomotion and
// choreography into one abstract MotionFrame per render frame. Deterministic for a given seed
// and command timeline; frame-rate independent. See docs/motion/INTEGRATION.md.
import { random } from './core/random';
import { CriticalSpring, SecondOrder } from './core/spring';
import { motionProfile, type MotionProfile } from './profile';
import { BlinkSystem } from './systems/blink';
import { ChoreographyPlayer, choreographies, selectChoreography } from './systems/choreography';
import { ExpressionSystem } from './systems/expressions';
import { FidgetSystem } from './systems/fidget';
import { GazeSystem, type GazeTarget } from './systems/gaze';
import { idleLayer } from './systems/idle';
import { Locomotion, type LocomotionCaps, type MoveCommand } from './systems/locomotion';
import {
  neutralPose,
  type Channel,
  type MotionFrame,
  type MotionSettings,
  type Pose,
  type Stage,
} from './types';

const ranges: Partial<Record<Channel, [number, number]>> = {
  gazeX: [-1, 1],
  gazeY: [-1, 1],
  blinkL: [0, 1],
  blinkR: [0, 1],
  browL: [-1.1, 1],
  browR: [-1.1, 1],
  squintL: [0, 1],
  squintR: [0, 1],
  smile: [-1, 1],
  mouthX: [-1, 1],
  mouthY: [-1, 1],
  squash: [-1, 1],
  // Hair: only the visually plausible part of each channel (probed; larger values balloon).
  hairSwing: [-0.25, 0.25],
  hairSwoop: [-0.18, 0.18],
  hairSquash: [-0.06, 0.06],
};

export class MotionLayer {
  readonly seed: number;
  private settings: MotionSettings;
  private profile: MotionProfile;
  private stage: Stage;
  private caps: LocomotionCaps;
  readonly expressions = new ExpressionSystem();
  private blink: BlinkSystem;
  private gaze: GazeSystem;
  private fidget: FidgetSystem;
  readonly locomotion: Locomotion;
  private choreo = new ChoreographyPlayer();
  private attention: GazeTarget | null = null;
  private hair = new SecondOrder({ f: 3, zeta: 0.35, r: 0 }, 0);
  private lastSway = 0;
  /** Output smoothing: no step inputs reach the rig; interrupted cues crossfade without pops. */
  private smoothers = new Map<Channel, CriticalSpring>();
  private lastX = 0;
  private lastTime: number | null = null;
  private lastChoreography: { entrance?: string; exit?: string } = {};

  constructor(seed: number, settings: MotionSettings, stage: Stage, caps: LocomotionCaps) {
    this.seed = seed;
    this.settings = settings;
    this.profile = motionProfile(settings);
    this.stage = stage;
    this.caps = caps;
    this.blink = new BlinkSystem(seed);
    this.gaze = new GazeSystem(seed);
    this.fidget = new FidgetSystem(seed);
    this.locomotion = new Locomotion(seed);
  }

  setSettings(settings: MotionSettings) {
    this.settings = settings;
    this.profile = motionProfile(settings);
  }

  setStage(stage: Stage) {
    this.stage = stage;
  }

  get currentProfile() {
    return this.profile;
  }

  reveal() {
    this.choreo.reveal();
  }

  get hidden() {
    return this.choreo.isHidden;
  }

  place(x: number, y: number) {
    this.locomotion.place(x, y);
    this.lastX = x;
  }

  express(id: string, options: { at: number; intensity?: number; hold?: number }) {
    this.fidget.interrupt();
    this.expressions.play(id, options);
  }

  release(id: string, at: number) {
    this.expressions.release(id, at);
  }

  /** Where to look: -1..1 in character space, or null to let the gaze wander. */
  attend(target: GazeTarget | null) {
    this.attention = target;
  }

  moveTo(command: MoveCommand) {
    this.fidget.interrupt();
    this.locomotion.moveTo(command);
  }

  wander(at: number) {
    this.locomotion.wander(at, this.stage);
  }

  /** Bring the character in. `id` omitted: seeded personality-weighted pick, never repeating. */
  enter(options: {
    at: number;
    cue: string;
    anchor: { x: number; y: number };
    id?: string;
    impactShake?: boolean;
  }) {
    const calm = this.settings.reducedMotion || this.settings.quiet;
    const id =
      options.id ??
      selectChoreography('entrance', {
        seed: this.seed,
        cue: options.cue,
        previous: this.lastChoreography.entrance,
        profile: this.profile,
      });
    const known = id in choreographies ? id : 'drop';
    this.lastChoreography.entrance = known;
    this.choreo.start(
      known,
      { at: options.at, anchor: options.anchor, impactShake: options.impactShake ?? false },
      this.locomotion,
      this.stage,
      calm,
    );
    return known;
  }

  /** Hide. Always immediate: interrupts any entrance, expression and travel. */
  exit(options: { at: number; cue: string; id?: string }) {
    const calm = this.settings.reducedMotion || this.settings.quiet;
    this.expressions.cut();
    this.locomotion.stop(options.at);
    const id =
      options.id ??
      selectChoreography('exit', {
        seed: this.seed,
        cue: options.cue,
        previous: this.lastChoreography.exit,
        profile: this.profile,
        personality: this.settings.personality,
      });
    const known = id in choreographies ? id : 'duck';
    this.lastChoreography.exit = known;
    const position = this.locomotion.position;
    this.choreo.start(
      known,
      { at: options.at, anchor: position },
      this.locomotion,
      this.stage,
      calm,
    );
    return known;
  }

  update(now: number): MotionFrame {
    const dt = this.lastTime === null ? 0 : Math.min(0.1, Math.max(0, now - this.lastTime));
    this.lastTime = now;
    const profile = this.profile;
    const stage = this.stage;
    const pose = neutralPose();
    const add = (partial: Partial<Pose>, gain = 1) => {
      for (const [key, value] of Object.entries(partial) as [Channel, number][])
        pose[key] += value * gain;
    };

    const loco = this.locomotion.update(dt, now, profile, stage, this.caps);
    const choreo = this.choreo.update(now, profile, stage, loco);
    for (const id of choreo.expressions) this.expressions.play(id, { at: now });
    const expr = this.expressions.evaluate(now, profile);
    const busy = this.expressions.isBusy(now) || loco.moving || choreo.choreography !== null;
    const fidget = this.fidget.update(now, profile, busy);
    const idle = idleLayer(now, this.seed, profile);

    // Gaze: system fixations, overridden by an expression's look, plus additive glances.
    const look = this.gaze.update(dt, now, profile, this.attention);
    const override = expr.gaze;
    const w = override ? override.weight : 0;
    pose.gazeX = look.x * (1 - w) + (override ? override.x * w : 0) + idle.gazeDriftX;
    pose.gazeY = look.y * (1 - w) + (override ? override.y * w : 0);
    pose.headTilt += look.headTilt;
    // Large gaze shifts recruit a blink (Evinger 1994), not every time.
    if (look.saccade > 0.45 && random(this.seed, 'saccade-blink', Math.floor(now * 10)) < 0.45)
      this.blink.trigger(now);

    const blink = this.blink.update(now, profile, expr.attentive);
    pose.blinkL = blink.left;
    pose.blinkR = blink.right;

    // Idle life (always on; scaled down by the profile in quiet/reduced modes).
    pose.squash += idle.squash;
    pose.bob += idle.bob;
    pose.lean += idle.lean;
    pose.headTilt += idle.headTilt;
    pose.shift += idle.shift;
    pose.armL += idle.armL;
    pose.armR += idle.armR;
    pose.hairSwing += idle.hairSwing;

    add(fidget.pose, profile.amplitude);
    add(expr.pose);
    add(loco.pose);
    add(choreo.pose);

    // Follow-through: hair lags behind head/body sway and travel (overlapping action).
    const sway = pose.headTilt + pose.lean;
    const swayVelocity = dt > 0 ? (sway - this.lastSway) / dt : 0;
    const travelVelocity =
      dt > 0 ? ((loco.x - this.lastX) * stage.aspect) / stage.bodyHeight / dt : 0;
    this.lastSway = sway;
    this.lastX = loco.x;
    this.hair.set(profile.hair);
    const drag = this.hair.update(dt, -0.35 * swayVelocity - 0.12 * travelVelocity * loco.facing);
    pose.hairSwing += drag;
    pose.hairSwoop += 0.3 * drag;

    for (const [key, [min, max]] of Object.entries(ranges) as [Channel, [number, number]][])
      pose[key] = Math.max(min, Math.min(max, pose[key]));
    // Smooth every channel except blinks (which must stay crisp): critical springs, no ringing.
    for (const key of Object.keys(pose) as Channel[]) {
      if (key === 'blinkL' || key === 'blinkR' || key.startsWith('foot')) continue;
      let spring = this.smoothers.get(key);
      if (!spring) {
        spring = new CriticalSpring(
          key.startsWith('hair') ? 0.12 : key.startsWith('gaze') ? 0.045 : 0.07,
          pose[key],
        );
        this.smoothers.set(key, spring);
      }
      pose[key] = spring.update(dt, pose[key]);
    }
    // Reduced motion: cap squash and travel-type body offsets.
    if (this.settings.reducedMotion) pose.squash = Math.max(-0.3, Math.min(0.3, pose.squash));

    const liftFraction = loco.lift + choreo.liftBH * stage.bodyHeight;
    const hidden = choreo.hidden;
    return {
      time: now,
      pose,
      clips: expr.clips,
      placement: {
        x: loco.x,
        y: loco.y - liftFraction,
        lean: 0,
        facing: loco.facing,
        scaleX: loco.scaleX * choreo.scaleX,
        scaleY: loco.scaleY * choreo.scaleY,
        opacity: hidden ? 0 : loco.opacity * choreo.opacity,
        clipBelow: choreo.clipBelow,
      },
      status: {
        expressions: expr.active,
        locomotion: loco.state + (loco.gait ? ':' + loco.gait : ''),
        choreography: choreo.choreography,
        fidget: fidget.id,
        hidden,
      },
    };
  }
}
