// The new Studio's small, pure rules: where a link leads, how far setup has got, and what the
// command palette shows. Kept free of React and the browser so tests can cover them.

export const modes = ['live', 'look', 'personality'] as const;
export type Mode = (typeof modes)[number];
export const sections = ['connections', 'layout', 'preferences'] as const;
export type Section = (typeof sections)[number];

/** The stage is where a streamer spends their time, with Settings as a panel over it; the
 *  welcome is the guided first-run setup. */
export type Route = { place: 'stage'; mode: Mode; settings?: Section } | { place: 'welcome' };

/** Reads `#look`, `#welcome` or `#settings/layout`; anything else is the fallback. */
export function parseRoute(hash: string, fallback: Route): Route {
  const [first = '', second = ''] = hash.replace(/^#/, '').split('/');
  const mode = modes.find((id) => id === first);
  if (mode) return { place: 'stage', mode };
  if (first === 'welcome') return { place: 'welcome' };
  if (first === 'settings')
    return {
      place: 'stage',
      mode: 'live',
      settings: sections.find((id) => id === second) ?? 'connections',
    };
  return fallback;
}

export function routeHash(route: Route): string {
  if (route.place === 'welcome') return '#welcome';
  return route.settings ? `#settings/${route.settings}` : `#${route.mode}`;
}

/** Remembered in the browser under the same key as the current Studio, so progress carries over. */
export type SetupProgress = { look: boolean; obs: boolean; chat: boolean; dock: boolean };
export const noProgress: SetupProgress = { look: false, obs: false, chat: false, dock: false };
export const setupSteps = ['look', 'obs', 'chat'] as const;
export type SetupStep = (typeof setupSteps)[number];

export function parseProgress(stored: unknown): SetupProgress {
  if (!stored || typeof stored !== 'object') return noProgress;
  const value = stored as Record<string, unknown>;
  return {
    look: value['look'] === true,
    obs: value['obs'] === true,
    chat: value['chat'] === true,
    dock: value['dock'] === true,
  };
}

export function stepsDone(progress: SetupProgress): number {
  return setupSteps.filter((step) => progress[step]).length;
}

/** The step to do next, or null once all three are done. */
export function nextStep(progress: SetupProgress): SetupStep | null {
  return setupSteps.find((step) => !progress[step]) ?? null;
}

export function statusLine(now: {
  connected: boolean;
  retracted: boolean;
  performing: boolean;
  quiet: boolean;
}): string {
  if (!now.connected) return 'Waiting for the service';
  if (now.retracted) return 'Taking a break';
  if (now.performing) return 'Reacting';
  return now.quiet ? 'Enjoying the quiet' : 'Hanging out';
}

/** A 0–100 setting said aloud: `spoken(62, ['Calm', 'Lively'])` is "Lively". */
export function spoken(value: number, words: readonly string[]): string {
  return words[Math.min(words.length - 1, Math.floor((value / 101) * words.length))] ?? '';
}

/** Every word typed must appear in the label or its keywords; an empty query keeps everything. */
export function filterCommands<T extends { label: string; keywords?: string }>(
  commands: readonly T[],
  query: string,
): T[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return [...commands];
  return commands.filter((command) => {
    const text = `${command.label} ${command.keywords ?? ''}`.toLowerCase();
    return words.every((word) => text.includes(word));
  });
}
