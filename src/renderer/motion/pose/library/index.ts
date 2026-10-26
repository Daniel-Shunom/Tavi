// Every authored beat, by id. The pose lab lists these; tests run the rubric over all of them.
import type { Beat } from '../schema';
import { climbUp } from './climb';
import { dustKnees } from './dust';

export const beats: Readonly<Record<string, Beat>> = Object.fromEntries(
  [climbUp, dustKnees].map((beat) => [beat.id, beat]),
);
