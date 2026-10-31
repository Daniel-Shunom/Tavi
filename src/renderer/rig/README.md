# Rig components

These mechanics are renderer-independent. Tavi's Rive adapter supplies artboard-local
coordinates and writes the resulting transforms; the library never reads the DOM or Tauri.

| Component          | Contract                                                                                                   | Current use                                                       |
| ------------------ | ---------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `BodyRig`          | Independent bounded pelvis/chest/neck/head articulation; restore before sampling; preserve draw order      | Foundation rig and lab                                            |
| `solveLimb`        | Exact rigid segment lengths; explicit bend; finite clamped endpoint and target error                       | Procedural standing legs                                          |
| `softReach`        | Continuous extension resistance; contact targets do not move                                               | Pelvis support                                                    |
| `projectSupport`   | Minimum common translation for compatible reach disks; explicit residual otherwise                         | Planted-foot support                                              |
| `Spring`           | Position + velocity; natural frequency in radians/second; damping ratio; exact constant-target integration | Secondary-motion building block                                   |
| `FollowThrough`    | Bounded garment motion; body-height travel; pause and teleport handling                                    | Skirt follow-through                                              |
| `Transition`       | Quintic position, velocity and acceleration boundary matching                                              | Lab pose envelopes; available for future state-player integration |
| `resolveOwnership` | Highest-priority channel writer; ambiguous ties fail regardless of input order                             | Available for future layered-controller integration               |

Lengths are positive artboard units, time is seconds, angles are radians. A two-bone solver
cannot fix missing artwork or choose a good acting pose. Supply a calibrated bend branch;
never infer it anew from a nearly straight moving limb.

Reapply animation/rest transforms before each contact correction. Do not accumulate a
pelvis offset into the next frame's input. Never filter a planted target to make the body
look smoother: soften extension or retarget the body instead.

`Transition.to()` matches the state at interruption. It may overshoot during a hard
reversal because momentum is preserved; use suitable authored ranges and durations.
`Spring.step()` assumes its target is constant over that step. A sampled moving target
still depends on sampling, so do not claim frame-rate invariance for arbitrary input.

See [the milestone plan](../../../docs/motion/RIG-FOUNDATION.md) for art, compositing,
articulation and actual OBS/Tauri delivery gates.
