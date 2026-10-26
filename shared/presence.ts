// Presence transitions: varied entrances and exits for "bring back" and "tuck away".
// The choreography itself (drop, walk, climb...) is performed by the motion layer; these cues
// carry the chosen id and a seed so the studio and every overlay play the same one. Because they
// are sampled on the service clock, a reconnect shows the current state without replaying.
import { z } from 'zod';

export const choreographies = {
  slide: {
    label: 'Slide',
    enter: 'Slides back up into place.',
    exit: 'Slides down out of view.',
  },
  drop: {
    label: 'Drop in',
    enter: 'Drops from the top of the screen and lands.',
    exit: 'Hops up and out of the top.',
  },
  walk: {
    label: 'Walk in',
    enter: 'A tired walk-in from the nearest side.',
    exit: 'Walks off the nearest side.',
  },
  climb: {
    label: 'Climb up',
    enter: 'Climbs up from the bottom edge.',
    exit: 'Climbs back down below the edge.',
  },
} as const;
export type ChoreographyId = keyof typeof choreographies;
export const choreographyIds = Object.keys(choreographies) as [ChoreographyId, ...ChoreographyId[]];
export const choreographyPreferenceSchema = z.enum(['random', ...choreographyIds]);
export type ChoreographyPreference = z.infer<typeof choreographyPreferenceSchema>;
/** Nominal durations (seconds). Motion layers may take longer; renderers use these as fallback. */
export const transitionDurations = { enter: 1.6, exit: 1.1 } as const;
export const presenceTransitionSchema = z
  .object({
    id: z.string().max(64),
    kind: z.enum(['enter', 'exit']),
    choreography: z.enum(choreographyIds),
    seed: z.number().int().nonnegative(),
    startAt: z.number(),
    /** Hidden amount when this transition began, so an interrupted entrance exits smoothly. */
    from: z.number().min(0).max(1),
  })
  .strict();
export type PresenceTransition = z.infer<typeof presenceTransitionSchema>;
/** Resolves "random" deterministically from the seed, avoiding the previous choice. */
export function pickChoreography(
  preference: ChoreographyPreference,
  seed: number,
  previous?: ChoreographyId,
): ChoreographyId {
  if (preference !== 'random') return preference;
  const pool = choreographyIds.filter((id) => id !== previous);
  return pool[seed % pool.length] ?? 'slide';
}
/** 0 = fully visible, 1 = fully hidden, for a transition sampled at service time `now`. */
export function hiddenAmount(
  transition: PresenceTransition | null,
  now: number,
  reducedMotion = false,
): number {
  if (!transition) return 0;
  const elapsed = (now - transition.startAt) / 1000;
  const progress = reducedMotion
    ? 1
    : Math.max(0, Math.min(1, elapsed / transitionDurations[transition.kind]));
  const goal = transition.kind === 'exit' ? 1 : 0;
  return transition.from + (goal - transition.from) * progress;
}
