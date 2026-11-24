import { describe, expect, it } from 'vitest';
import {
  filterCommands,
  nextStep,
  noProgress,
  parseProgress,
  parseRoute,
  routeHash,
  spoken,
  statusLine,
  stepsDone,
  type Route,
} from '../../src/studio-next/model';

const stage: Route = { place: 'stage', mode: 'live' };
const welcome: Route = { place: 'welcome' };

describe('new Studio routes', () => {
  it('reads a stage mode from the hash', () => {
    expect(parseRoute('#look', stage)).toEqual({ place: 'stage', mode: 'look' });
    expect(parseRoute('#personality', welcome)).toEqual({ place: 'stage', mode: 'personality' });
  });

  it('reads the welcome', () => {
    expect(parseRoute('#welcome', stage)).toEqual(welcome);
  });

  it('opens Settings over the stage, defaulting to its first section', () => {
    expect(parseRoute('#settings', welcome)).toEqual({
      place: 'stage',
      mode: 'live',
      settings: 'connections',
    });
    expect(parseRoute('#settings/layout', stage)).toEqual({
      place: 'stage',
      mode: 'live',
      settings: 'layout',
    });
    expect(parseRoute('#look/settings/preferences', stage)).toEqual({
      place: 'stage',
      mode: 'look',
      settings: 'preferences',
    });
    expect(routeHash({ place: 'stage', mode: 'look', settings: 'preferences' })).toBe(
      '#look/settings/preferences',
    );
    expect(routeHash({ place: 'stage', mode: 'live', settings: 'layout' })).toBe(
      '#settings/layout',
    );
    expect(parseRoute('#settings/nowhere', stage)).toEqual({
      place: 'stage',
      mode: 'live',
      settings: 'connections',
    });
  });

  it('keeps the fallback for an empty or unknown hash', () => {
    expect(parseRoute('', welcome)).toBe(welcome);
    expect(parseRoute('#widgets', stage)).toBe(stage);
  });

  it('writes a hash that reads back to the same route', () => {
    const routes: Route[] = [
      stage,
      { place: 'stage', mode: 'look' },
      welcome,
      { place: 'stage', mode: 'live', settings: 'preferences' },
    ];
    for (const route of routes) expect(parseRoute(routeHash(route), stage)).toEqual(route);
  });
});

describe('setup progress', () => {
  it('treats anything but a saved true as not done', () => {
    expect(parseProgress(null)).toEqual(noProgress);
    expect(parseProgress('yes')).toEqual(noProgress);
    expect(parseProgress({ look: true, obs: 'true', chat: 1 })).toEqual({
      ...noProgress,
      look: true,
    });
  });

  it('counts the three steps and leaves the optional dock out', () => {
    expect(stepsDone(noProgress)).toBe(0);
    expect(stepsDone({ look: true, obs: true, chat: false, dock: true })).toBe(2);
  });

  it('points at the first step still to do', () => {
    expect(nextStep(noProgress)).toBe('look');
    expect(nextStep({ ...noProgress, look: true })).toBe('obs');
    expect(nextStep({ look: true, obs: false, chat: true, dock: false })).toBe('obs');
    expect(nextStep({ look: true, obs: true, chat: true, dock: false })).toBeNull();
  });
});

describe('what she is doing', () => {
  const now = { connected: true, retracted: false, performing: false, quiet: false };
  it('puts the service, then a break, then a reaction first', () => {
    expect(statusLine({ ...now, connected: false, retracted: true })).toBe(
      'Waiting for the service',
    );
    expect(statusLine({ ...now, retracted: true, performing: true })).toBe('Taking a break');
    expect(statusLine({ ...now, performing: true, quiet: true })).toBe('Reacting');
    expect(statusLine({ ...now, quiet: true })).toBe('Enjoying the quiet');
    expect(statusLine(now)).toBe('Hanging out');
  });
});

describe('a setting said aloud', () => {
  const words = ['Very calm', 'Calm', 'Easygoing', 'Lively', 'Very lively'];
  it('covers the whole range without running off either end', () => {
    expect(spoken(0, words)).toBe('Very calm');
    expect(spoken(62, words)).toBe('Lively');
    expect(spoken(100, words)).toBe('Very lively');
  });
});

describe('jump to anything', () => {
  const commands = [
    { label: 'Change her look', keywords: 'hair body outfit' },
    { label: 'Turn quiet mode on' },
    { label: 'Setup: connections', keywords: 'twitch youtube obs' },
  ];
  it('keeps everything for an empty search', () => {
    expect(filterCommands(commands, '  ')).toHaveLength(3);
  });
  it('matches labels and keywords, whatever the case', () => {
    expect(filterCommands(commands, 'HAIR').map((c) => c.label)).toEqual(['Change her look']);
    expect(filterCommands(commands, 'quiet').map((c) => c.label)).toEqual(['Turn quiet mode on']);
  });
  it('needs every typed word to match', () => {
    expect(filterCommands(commands, 'setup twitch')).toHaveLength(1);
    expect(filterCommands(commands, 'setup hair')).toHaveLength(0);
  });
});
