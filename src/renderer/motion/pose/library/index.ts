// Every authored beat, by id. The pose lab lists these; tests run the rubric over all of them.
import type { Beat } from '../schema';
import { climbUp } from './climb';
import { dustKnees } from './dust';
import { sitFloorSlouch, sitFloorUpright, sitLedgeSlouch, sitLedgeUpright } from './sit';
import { peekStandingVariants } from './peek';

export const beats: Readonly<Record<string, Beat>> = Object.fromEntries(
  [
    climbUp,
    dustKnees,
    sitFloorUpright,
    sitFloorSlouch,
    sitLedgeUpright,
    sitLedgeSlouch,
    ...peekStandingVariants,
  ].map((beat) => [beat.id, beat]),
);
