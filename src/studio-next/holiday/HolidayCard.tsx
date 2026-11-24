import type { ReactNode } from 'react';
import { ToggleRow } from '../ui';
import { countdownLine, daysUntil, type HolidayId } from './calendar';
import type { Room } from './rooms';

/** Everything a holiday theme brings to the stage. */
export type Holiday = {
  id: HolidayId;
  label: string;
  /** Its small festive mark. */
  icon: ReactNode;
  room: Room;
  roomOn: boolean;
  onRoom: (on: boolean) => void;
  /** The reaction its key cues, when her character can perform it. */
  cue?: { label: string };
  onCue: () => void;
};

/** The holiday card on the Live panel: a countdown, and the one switch for her room. */
export function HolidayCard({ holiday }: { holiday: Holiday }) {
  return (
    <section className="sn-holiday" aria-label={`${holiday.label} theme`}>
      <div className="sn-holiday-head">
        <span className="sn-holiday-mark" aria-hidden="true">
          {holiday.icon}
        </span>
        <div>
          <b>{countdownLine(holiday.label, daysUntil(holiday.id, new Date()))}</b>
          <span>{holiday.label} theme</span>
        </div>
      </div>
      <ToggleRow
        title="Decorate her room"
        detail={
          holiday.roomOn ? 'Only in Studio, never on stream' : 'Showing the plain stream view'
        }
        checked={holiday.roomOn}
        onChange={holiday.onRoom}
      />
    </section>
  );
}
