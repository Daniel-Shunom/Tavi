# Motion layer integration contract

The expression/cue system decides **what** and **when**; the motion layer (`src/renderer/motion/`) decides **how it moves**. Everything is deterministic for a given seed and cue timeline and independent of frame rate.

## Per-frame flow

```text
cues (shared clock) --> MotionLayer commands --> layer.update(clock) --> MotionFrame (abstract pose)
                                                                 --> RigBinding (e.g. bindLyla) --> MotionRig.frame()
```

`MotionFrame` = `{ pose: Record<Channel, number>, clips: ClipRequest[], placement, status }`. Channels are character-agnostic (`types.ts`: gaze, blinks, brows, squint, smile, mouth, squash, hair, headTilt, lean, bob, shift, arms, feet). A binding maps them to a specific rig; channels a rig lacks are simply ignored.

## Commands (all take `at` = shared cue start time, seconds)

| Command                                                                                                            | Use                                                                                                                                                                                                                                                                                                                     |
| ------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `express(id, { at, intensity?, hold? })`                                                                           | Play a shaped expression: latency, anticipation, attack, overshoot, settle, moving hold, release. `hold: Infinity` holds until `release(id, at)`. Library ids: listening, skeptical, caught, approve, celebrate, wave, think, happy, surprise, bashful, tired, yawn, dustOff, determined. Several can overlap (summed). |
| `release(id, at)` / `expressions.clear(at)` / `expressions.cut()`                                                  | Graceful release from the current value / release all / instant cut (hide).                                                                                                                                                                                                                                             |
| `attend(target or null)`                                                                                           | Gaze target in character space (-1..1). The gaze system adds holds, saccades, glances away (personality-dependent).                                                                                                                                                                                                     |
| `moveTo({ x, y?, at, gait?, speed?, faceOnArrival? })`                                                             | Walk/hop to a normalised stage point. Gait from distance + personality if omitted (`step`, `amble`, `scoot`, `tired`, `hop`). Targets are clamped to safe bounds. Reduced motion fades and relocates. Perch = `moveTo(anchor)`.                                                                                         |
| `wander(at)`                                                                                                       | Short seeded amble nearby.                                                                                                                                                                                                                                                                                              |
| `enter({ at, cue, anchor, id? })` / `exit({ at, cue, id? })`                                                       | Entrance/exit choreography. `id` omitted: seeded by `cue`, personality-weighted, never repeating the previous. Exit is immediate and continues from the current pose (hiding mid-entrance). Quiet/reduced use a short fade. A cue whose `at` is far in the past jumps to its end state (reconnect never replays).       |
| `setSettings({ personality, attitude, energy, reducedMotion, quiet })`, `setStage({ aspect, bodyHeight, margin })` | Profile and stage size.                                                                                                                                                                                                                                                                                                 |

Overlap: expressions, gaze and locomotion are independent layers, so "walk while waving" is `moveTo` + `express('wave')`, and "look at chat while walking" is `moveTo` + `attend(chatDirection)`. Locomotion adds a look-ahead gaze while travelling; an expression's gaze override wins by weight.

## Proposed cue fields for the expression agent's `ExpressionScript`

- Expression cue: `{ kind: 'expression', id, intensity, startAt, hold?, releaseAt? }` -> `express` / `release`.
- Presence cue: `{ kind: 'presence', action: 'moveTo' | 'perch' | 'peek' | 'wander' | 'enter' | 'exit', target?: { x, y } | anchorId, gait?, speed?, choreography?, startAt, cueId }` -> `moveTo` / `enter` / `exit`. For exact studio/overlay agreement the service should resolve and embed `choreography` (call `selectChoreography`, a pure function) so reconnecting clients do not need the previous choice.
- Attention cue: `{ kind: 'attention', target: 'streamer' | 'chat' | 'pointer' | null, startAt }` -> `attend` (the app maps targets to directions).
- Seed: one per character profile, shared by studio and overlay.

## Official hook (merged)

`motion/hook.ts` registers with `registerMotionLayer` (installed from `src/main.tsx`). Per frame it maps the hook input onto MotionLayer commands: `performances` nod/skeptical/caught -> `approve`/`skeptical`/`caught`; `attention.side` -> gaze; `locomotion.target` -> `moveTo` (walk/hop instead of the fallback glide); presence styles enter slide/drop/walk/climb -> `slideUp`/`drop`/`tiredWalk`/`climb`, exit -> `duck`/`jumpOut`/`walkOff`/`hopOff`. It returns `ctl.*` control-track samples and node transforms (manifest handles from `characters/mascot/motion.ts`), the position, facing and `presence.hidden`. The renderer applies the character's motion-rig patch at load (`characters/motionRigs.ts`) and treats node transforms as additive over clip-animated values.

Open points: the renderer has no clip mask, so climbing/sinking fades by depth instead of being cut at the ground line; "Surprise me" is resolved by `pickChoreography` (shared/presence.ts), which does not yet use the personality weights in `profile.ts` (`entranceWeights`); facing is returned but the renderer does not mirror yet.

## Rig adapter

`rive/motionRig.ts` loads the .riv with an in-memory `RigPatch` (`rive/patch.ts`): runtime names on chosen nodes and single-property control tracks for joystick channels. Per frame: reset to rest, authored clips (played forward in real time, not scrubbed), channel writes (`value`, `weight`), additive node offsets, `artboard.advance`, draw with lean/facing/squash placement. A new character supplies a manifest like `rigs/lyla.ts` and a binding like `rigs/lylaBinding.ts`.
