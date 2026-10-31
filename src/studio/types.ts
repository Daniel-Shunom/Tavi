import type { useConnection } from '../useConnection';
import type { State } from '../../shared/protocol';

/** What every Studio screen receives: the live connection, plus what she is doing right now. */
export type StudioProps = ReturnType<typeof useConnection> & {
  /** The reaction playing now, or null. */
  performing: State['performance']['script'] | null;
  /** A short, human line for her current state ("Hanging out", "Tucked away"…). */
  statusLine: string;
};
