# Rive authoring notes for body states

For the remix of the mascot (Lyla) in the user's Rive account. Everything here is currently
faked procedurally (`src/renderer/characters/mascot/states.ts`); each item says what reads now,
what does not, and exactly what to author so the manifest can switch to clips. Units: `u` =
artboard units of `lyla animation` (600 x 600); soles at y 545, so "above the soles" = 545 - y.

## What the procedural version cannot do

| State            | Procedural now                                                                 | Why it falls short                                                                        |
| ---------------- | ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| Sit on a ledge   | Hips -10 u, feet lifted 18 u (knees toward camera), arms 0.4 rad onto the edge | No thigh foreshortening; shins cannot swing from the knee (IK only moves the foot target) |
| Sit on the floor | Hips down 106 u (deeper sinks the skirt), feet splayed 55 u                    | Reads as a squat-sit; no cross-legged or knees-up pose; hands cannot rest on knees        |
| Doze             | Floor/ledge sit + head roll 0.3-0.38, head down 25-35 u, eyes closed           | No head pitch (the face cannot nod forward); reads well anyway                            |
| Nap              | Whole body rotated about -62 deg about the soles so head and feet both touch   | A front view rotated, not a side-lying body; flat (-90 deg) floats 0.18 BH (head is wide) |
| Wake stretch     | Arms out to 1.5 rad in a V, squash -1, mouth open                              | Arms disappear behind the head above ~1.6 rad: no overhead stretch                        |
| Peek             | Upper lean -0.38, head -0.3, hips +40 u, body rotated 7 deg toward the panel   | No hand on the panel edge                                                                 |
| Lean             | Body rotated ~14 deg about the soles until the hair touches the edge           | No crossed ankles, no folded arms, shoulder cannot touch first                            |
| Perch            | Crouch (hips 90 u, feet 45 u) on the top edge                                  | Fine                                                                                      |

## Bones and constraints to add

- `thigh_L/R`, `shin_L/R` with a two-bone IK per leg (targets `foot_L_target`, `foot_R_target`
  stay), so the knee can come toward the camera (seated foreshortening) and the shin can swing.
- `pelvis` pivot at the seat contact (y 440 u when seated on a ledge, y 545 u when sitting on the
  floor): the runtime will rotate and place the body about it.
- `hand_L/R` with IK targets `hand_L_target`, `hand_R_target` (hands on an edge, on knees, under
  the cheek).
- `head` pitch: a `head_pitch` bone or a `faceY`-driven head tilt that moves the whole face down
  and forward (nod-offs, looking down into the webcam).
- Lyla v2 already has elbows (`arm-l-fore`/`arm-r-fore`), hand poses (`ctl.hand-l/-r`) and an
  arms-in-front switch (`ctl.arms-front`). These can improve the procedural sit and nap now:
  arms in front with elbows bent reads as hugging the knees or resting the head on an arm.

## Clips (60 fps, names exact, bones only, no face keys; mark contacts in the description)

| Clip             | Length      | Notes                                                                                                                        |
| ---------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `sit_floor`      | pose (1 fr) | Knees up and together, hands on knees, seat on the floor line (contact: seat y 545)                                          |
| `sit_ledge`      | pose        | Thighs forward and foreshortened, shins hanging, hands on the edge beside the hips (contact: seat y 440 on the edge line)    |
| `swing_legs`     | loop 1.0 s  | Additive: shins swing +-25 deg at the knee, legs alternate; amplitude driven by a `swing` number 0..1                        |
| `sit_down`       | 1.4 s       | Lean, hips back, touch at 0.8 s (mark it), small overshoot, settle                                                           |
| `stand_up`       | 1.2 s       | Lean forward, seat-off at 0.35 s, rise past standing, settle                                                                 |
| `hop_up_ledge`   | 0.9 s       | Crouch 0.25 s, take-off, tuck, land standing on the edge; runtime scales the height (keep the root path separate)            |
| `hop_down_ledge` | 0.7 s       | Push off the edge with both hands, drop, land with knees bent                                                                |
| `lie_side`       | pose        | True side-lying: lower edge flat on the floor line, head resting on the lower arm, knees bent (contact: hip, shoulder, head) |
| `lie_down`       | 2.4 s       | Hand to floor, roll to the side, head down last                                                                              |
| `get_up`         | 3.0 s       | Roll, push up on one arm, pause at the kneel, stand                                                                          |
| `sleep_breath`   | loop 5.0 s  | Additive: belly then shoulders, 2-3% torso scale, regular                                                                    |
| `nod_off`        | 2.6 s       | Head sags over 2.5 s, snaps up in 0.12 s                                                                                     |
| `stretch`        | 2.0 s       | Arms overhead, up on the toes, back arched                                                                                   |
| `yawn`           | 2.5 s       | Face: mouth wide (a face clip, separate from the body)                                                                       |
| `peek_lean`      | pose        | Lean in, one hand on a vertical edge at chest height                                                                         |
| `lean_wall`      | pose        | Shoulder and side of the head on a wall at screen-left (mirror for right), ankles crossed, arms folded                       |
| `perch_crouch`   | pose        | Bird crouch on an edge, hands between the feet                                                                               |

## Extras

- `zzz` nested artboard: three Zs, driven by a 0..1 `zzz` number (the renderer draws DOM glyphs
  today: `src/renderer/motion/states/effects.ts`).
- `snot_bubble`: 0..1 inflate number, for deep sleep.
- View-model numbers: `sleepiness` 0..1 (droops lids and head), `swing` 0..1.

## How the manifest will consume them

A state key pose becomes `{ clip: 'sit_ledge', contact: { seat: 440 } }` instead of channel
values; transitions map to clips (`sit_down`, `stand_up`, `lie_down`, `get_up`, `hop_up_ledge`,
`hop_down_ledge`). The player keeps placing the root (ledge height, physics for jumps), so author
clips in place, with the root fixed and contacts marked.
