# Body states

Persistent poses with enter, hold and exit: stand, sit (floor or a frame edge), doze, nap, peek
at chat, perch and lean. Expressions are momentary and layer over them (laughing while sitting).
Research and numbers: `docs/motion/BODY-STATES-RESEARCH.md`. Rive authoring notes for the remix:
`RIVE-AUTHORING.md`.

## Data flow

```text
studio dock / rules triggers / provider "state"     server/companion.ts (priority, wake, stir)
        |                                                   |
server/behavior/states.ts (chat burst, quiet chain) --> BodyCue in performance.body (+ walk in
        |                                                   performance.movement)
shared/states.ts: library, scene rects, resolveSpot, thresholds
        v
Avatar -> MotionInput.body {cue, elapsed} -> motion/hook.ts -> BodyStatePlayer (motion/states/)
        -> key pose layered on the MotionFrame (apply.ts) -> rig binding
        -> MotionOutput.position (lift), offset (rotation about the soles), shadow, states
           (z z z, a lying body's floor shadow, a portrait ledge) drawn by Avatar
```

- **BodyCue** (`shared/states.ts`): `state`, `spot` (surface, contact x/y, approach point, side,
  edge), `from` (previous state and spot, so every client plays the same transition), `startAt`
  on the service clock, `wake` (urgent/normal), `stirAt`, `until`, `seed`. `null` = standing at
  home. A cue older than its settle time is shown held, never replayed (reconnects).
- **Spots** are resolved by the service from the scene (`config.scene`: webcam, game/VOD, chat
  rectangles and an optional floor line, edited in Studio > Placement). Ledges are horizontal
  frame edges 0.15-1.2 body heights above the floor with headroom; perch is a top edge with
  standing headroom; lean is a vertical frame edge that spans the body at floor level; peek stands
  beside the chat rectangle. Naps are always on the floor.
- **Player phases**: exit the previous state at its spot, travel with the normal locomotion
  (held back until the exit is done), enter on arrival, hold with the state's own life (leg swing,
  nod-offs, sleep breath, reading saccades, contrapposto). Jumps are ballistic on
  `core/physics.ts` gravity; landings squash by impact speed. Contacts are solved, not hand-set:
  ledge seat height, the two-contact lie angle, the lean angle that rests the hair on the edge.
- **Layering**: awake states add to the frame, so expressions act on top. Doze and nap own the
  face and body (`sleep` weight damps everything else and closes the eyes); any studio gesture,
  typed line or addressed chat wakes Tavi first.

## Triggers (rules, never AI)

| Trigger                                                                                                                                      | State                                       |
| -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| Studio dock: Stand, Sit, Nap, Peek at chat (60 s), Perch, Lean                                                                               | as chosen; manual, not overridden for 2 min |
| Chat burst: >= max(floor, 3x 10-min baseline) messages in 30 s from >= 3 chatters; floor = round(14 - 8 x engagement/100) x initiative scale | peek 15-45 s, ends 8 s after chat calms     |
| Quiet (no studio action, typed line, addressed chat or burst): settle 3 min, doze +6, lie +3; x personality, energy, initiative              | sit / perch / lean, then doze, then nap     |
| Asleep 12-20 min                                                                                                                             | wakes with a stretch, sits, may doze again  |
| Studio gesture / typed line / addressed chat while asleep                                                                                    | urgent / normal / normal wake               |
| One unaddressed chat message while asleep                                                                                                    | a stir (no wake)                            |
| Provider `state` (AI or rules; "take a nap", "go check chat"...)                                                                             | gated by initiative and a 90 s cooldown     |

Quiet mode blocks initiative-driven states and ends an automatic peek; manual states still work.
Tucking away clears the state; Tavi comes back standing. Thresholds live in
`shared/states.ts` (`burstRules`, `quietRules`).

## Adding a character

Supply `states: StateRig` in the character's motion rig (`characters/<id>/motion.ts`): key poses
in pose-channel units and contact points (seat height above the soles, lie contacts, lean
contact, head centre), measured by rendering the rig (see the research doc). Characters without
it ignore body states. Lyla v2 reuses the mascot's rig (same skeleton; seat contact re-measured
at a 106 u hip drop on both files).
