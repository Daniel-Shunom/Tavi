import { isJudgingSession } from '../judging/transport';
import { noProgress, parseProgress, type SetupProgress } from './model';
import { isHolidayId, type HolidayId } from './holiday/calendar';
import { defaultTheme, parseTheme, type ThemeChoice } from './themes';

// What the new Studio remembers in this browser. It shares the setup key with the current
// Studio, so progress carries over. Judging sessions remember nothing.

// The new Studio's theme has its own key: the current Studio and the OBS dock keep theirs.
const THEME_KEY = 'tavi.studio.next.theme';
const SETUP_KEY = 'tavi.studio.setup';
const STARTED_KEY = 'tavi.studio.started';
const ROOM_KEY = 'tavi.studio.next.room';

function read(key: string): string | null {
  if (isJudgingSession()) return null;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function write(key: string, value: string) {
  if (isJudgingSession()) return;
  try {
    localStorage.setItem(key, value);
  } catch {
    // Private windows may refuse storage; Studio still works, it just forgets.
  }
}

export function readTheme(): ThemeChoice {
  try {
    return parseTheme(JSON.parse(read(THEME_KEY) ?? 'null'));
  } catch {
    return defaultTheme;
  }
}
export function rememberTheme(theme: ThemeChoice) {
  write(THEME_KEY, JSON.stringify(theme));
}

export function readProgress(): SetupProgress {
  try {
    return parseProgress(JSON.parse(read(SETUP_KEY) ?? '{}'));
  } catch {
    return noProgress;
  }
}
export function rememberProgress(progress: SetupProgress) {
  write(SETUP_KEY, JSON.stringify(progress));
}

/** False only on the very first launch, which opens in Setup; every later one opens on the stage. */
export function readStarted(): boolean {
  return read(STARTED_KEY) === 'yes';
}
export function rememberStarted() {
  write(STARTED_KEY, 'yes');
}

/** Whether a holiday theme also dresses her room. On unless the streamer switched it off. */
export function readRoom(): boolean {
  return read(ROOM_KEY) !== 'off';
}
export function rememberRoom(on: boolean) {
  write(ROOM_KEY, on ? 'on' : 'off');
}

/** For previewing: `/studio?holiday=halloween` shows that holiday's season whatever the
 *  date, and `?holiday=none` shows no season. Nothing in Studio links to it. */
export function readSeasonPreview(): HolidayId | 'none' | null {
  const value = new URLSearchParams(location.search).get('holiday');
  return value === 'none' || isHolidayId(value) ? value : null;
}
