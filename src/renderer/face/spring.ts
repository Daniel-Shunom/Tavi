// Critically damped spring, solved exactly per step so it is frame-rate independent and stable for
// any dt (see Holden, "Spring-It-On", theorangeduck.com/page/spring-roll-call). Retargeting
// mid-flight keeps position and velocity continuous: the same property inertialization gives.
export interface SpringState {
  value: number;
  velocity: number;
}

/** `halfLife` seconds to cover half the distance to the target. */
export function stepSpring(state: SpringState, target: number, halfLife: number, dt: number) {
  if (dt <= 0) return state;
  if (halfLife <= 1e-4) {
    state.value = target;
    state.velocity = 0;
    return state;
  }
  const y = (4 * Math.LN2) / halfLife / 2; // damping / 2 for critical damping
  const j0 = state.value - target;
  const j1 = state.velocity + j0 * y;
  const eydt = Math.exp(-y * dt);
  state.value = eydt * (j0 + j1 * dt) + target;
  state.velocity = eydt * (state.velocity - j1 * y * dt);
  return state;
}
