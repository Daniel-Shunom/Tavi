import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import type { useConnection } from '../useConnection';
import { catalog } from '../renderer/characters/registry';
import { isScriptActive } from '../../shared/cue';
import { useOverlayUrl } from '../judging/Session';
import { quickCues, supports, typing } from '../studio/parts';
import {
  parseRoute,
  routeHash,
  statusLine as describe,
  type Mode,
  type Route,
  type Section,
  type SetupProgress,
} from './model';
import { Palette, type PaletteCommand } from './Palette';
import { Rehearse } from './Rehearse';
import { Settings } from './Settings';
import { Stage } from './Stage';
import {
  readProgress,
  readStarted,
  readTheme,
  rememberProgress,
  rememberStarted,
  readRoom,
  readSeasonPreview,
  rememberRoom,
  rememberTheme,
} from './storage';
import {
  activeScheme,
  chooseScheme,
  offeredSchemes,
  resolveTheme,
  themeVars,
  toneChoices,
  type ThemeChoice,
} from './themes';
import { holidayInSeason } from './holiday/calendar';
import type { Holiday } from './holiday/HolidayCard';
import { rooms } from './holiday/rooms';
import { motifIcons } from './motifs';
import { LayerContext } from './ui';
import { Wizard } from './Wizard';
import '@fontsource/fraunces/400.css';
import '../studio.css';
import './studio-next.css';

// The new Studio (/studio-next): one stage for every day, with Settings as a panel over it and a
// guided welcome for the first meeting. It shares the service connection, saved settings and
// browser memory with the current Studio, so both can run side by side. The very first launch
// opens the welcome; every later one opens on the stage.

const darkQuery = '(prefers-color-scheme: dark)';
/** Whether the computer is set to a dark appearance, kept up to date. */
function useSystemDark() {
  return useSyncExternalStore(
    (onChange) => {
      const query = matchMedia(darkQuery);
      query.addEventListener('change', onChange);
      return () => {
        query.removeEventListener('change', onChange);
      };
    },
    () => matchMedia(darkQuery).matches,
  );
}

export function StudioNext(connection: ReturnType<typeof useConnection>) {
  const { state, connected, send, serverNow } = connection;
  const overlayUrl = useOverlayUrl();
  const [root, setRoot] = useState<HTMLDivElement | null>(null);
  const character = catalog[state.config.character];
  const [theme, setTheme] = useState<ThemeChoice>(readTheme);
  const systemDark = useSystemDark();
  // The holiday in season shows by itself; the streamer can swap out of it for their own.
  const [seasonPreview] = useState(readSeasonPreview);
  const season = seasonPreview === 'none' ? null : (seasonPreview ?? holidayInSeason(new Date()));
  const { tone, palette: colours } = resolveTheme(theme, systemDark, season);
  const scheme = activeScheme(theme, season);
  const vars = useMemo(() => ({ ...themeVars(colours, tone), colorScheme: tone }), [colours, tone]);
  const [progress, setProgress] = useState<SetupProgress>(readProgress);
  const [route, setRoute] = useState<Route>(() =>
    parseRoute(
      location.hash,
      readStarted() ? { place: 'stage', mode: 'live' } : { place: 'welcome' },
    ),
  );
  const [palette, setPalette] = useState(false);
  const [rehearse, setRehearse] = useState(false);
  const [, setTick] = useState(0);
  const [roomOn, setRoomOn] = useState(readRoom);
  // A holiday theme brings three things: her room, a ninth reaction key and a countdown card.
  const holidayCue = 'motif' in scheme ? quickCues[rooms[scheme.id].key.cue] : undefined;
  const cueHoliday = useCallback(() => {
    if (!holidayCue) return;
    send({
      type: 'perform',
      ...holidayCue.cue,
      ...(holidayCue.target ? { target: holidayCue.target } : {}),
    });
  }, [holidayCue, send]);
  const holiday: Holiday | undefined =
    'motif' in scheme
      ? {
          id: scheme.id,
          label: scheme.label,
          icon: motifIcons[scheme.motif],
          room: rooms[scheme.id],
          roomOn,
          onRoom: (on) => {
            setRoomOn(on);
            rememberRoom(on);
          },
          ...(holidayCue && supports(character, holidayCue.cue)
            ? { cue: { label: holidayCue.label } }
            : {}),
          onCue: cueHoliday,
        }
      : undefined;
  const settings = route.place === 'stage' ? (route.settings ?? null) : null;
  const mode: Mode = route.place === 'stage' ? route.mode : 'live';

  useEffect(() => {
    rememberStarted();
    document.title = 'Tavi · Studio';
    const follow = () => {
      setRoute((current) => parseRoute(location.hash, current));
    };
    addEventListener('hashchange', follow);
    // Re-render once a second so "what she is doing" clears when a reaction finishes.
    const timer = setInterval(() => {
      setTick((value) => value + 1);
    }, 1000);
    return () => {
      removeEventListener('hashchange', follow);
      clearInterval(timer);
    };
  }, []);

  // Rehearse belongs to the Live stage: any other route closes it, however the route changed.
  useEffect(() => {
    if (route.place !== 'stage' || route.mode !== 'live' || route.settings) setRehearse(false);
  }, [route]);

  const go = useCallback((next: Route) => {
    setRoute(next);
    history.replaceState(null, '', routeHash(next));
    document.getElementById('studio-main')?.scrollTo({ top: 0 });
  }, []);
  const goMode = useCallback(
    (next: Mode) => {
      go({ place: 'stage', mode: next });
    },
    [go],
  );
  const openSettings = useCallback(
    (section: Section) => {
      go({ place: 'stage', mode, settings: section });
    },
    [go, mode],
  );
  const goWelcome = useCallback(() => {
    go({ place: 'welcome' });
  }, [go]);
  const updateProgress = useCallback((change: Partial<SetupProgress>) => {
    setProgress((current) => {
      const next = { ...current, ...change };
      rememberProgress(next);
      return next;
    });
  }, []);
  const pickTheme = useCallback((next: ThemeChoice) => {
    setTheme(next);
    rememberTheme(next);
  }, []);

  // Streamer-first keys on the stage: 1–8 cue the quick reactions, Esc stops, and Ctrl K opens
  // "Jump to anything". An open drawer or dialog keeps Esc for itself.
  const onStage = route.place === 'stage';
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setPalette((open) => !open);
        return;
      }
      if (palette || settings || !onStage || !connected) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key === 'Escape') {
        if (!rehearse) send({ type: 'cancel' });
        return;
      }
      if (typing(event.target) || state.retracted) return;
      if (event.key === '9' && holidayCue && supports(character, holidayCue.cue)) {
        event.preventDefault();
        cueHoliday();
        return;
      }
      const entry = quickCues[Number(event.key) - 1];
      if (!entry || !supports(character, entry.cue)) return;
      event.preventDefault();
      send({ type: 'perform', ...entry.cue, ...(entry.target ? { target: entry.target } : {}) });
    }
    addEventListener('keydown', onKey);
    return () => {
      removeEventListener('keydown', onKey);
    };
  }, [
    palette,
    settings,
    onStage,
    rehearse,
    connected,
    send,
    character,
    state.retracted,
    holidayCue,
    cueHoliday,
  ]);

  const performing = isScriptActive(state.performance.script, serverNow())
    ? state.performance.script
    : null;
  const statusLine = describe({
    connected,
    retracted: state.retracted,
    performing: performing !== null,
    quiet: state.quiet,
  });
  const props = { ...connection, performing, statusLine };

  const commands = useMemo<PaletteCommand[]>(() => {
    const away = !connected || state.retracted;
    const place = (
      id: string,
      label: string,
      keywords: string,
      run: () => void,
    ): PaletteCommand => ({
      id,
      label,
      kind: 'Place',
      keywords,
      run,
    });
    return [
      place('live', 'Go to Live', 'stage stream', () => {
        goMode('live');
      }),
      place('look', 'Go to Look', 'hair body face outfit name appearance', () => {
        goMode('look');
      }),
      place('personality', 'Go to Personality', 'nature energy humour chat mood', () => {
        goMode('personality');
      }),
      place('rehearse', 'Rehearse', 'test preview stream event expressions try', () => {
        goMode('live');
        setRehearse(true);
      }),
      place('connections', 'Settings: connections', 'twitch youtube obs dock overlay chat', () => {
        openSettings('connections');
      }),
      place('layout', 'Settings: stream layout', 'webcam game scene perch placement', () => {
        openSettings('layout');
      }),
      place('preferences', 'Settings: preferences', 'captions theme ai model decides', () => {
        openSettings('preferences');
      }),
      place('welcome', 'Run setup again', 'welcome first obs steps hello', goWelcome),
      {
        id: 'quiet',
        label: state.quiet ? 'Turn quiet mode off' : 'Turn quiet mode on',
        kind: 'Action',
        disabled: !connected,
        run: () => {
          send({ type: 'quiet', value: !state.quiet });
        },
      },
      {
        id: 'break',
        label: state.retracted ? 'Call her back' : 'Give her a break',
        kind: 'Action',
        keywords: 'hide show retract tuck away',
        disabled: !connected,
        run: () => {
          send({ type: 'retract', value: !state.retracted });
        },
      },
      {
        id: 'stop',
        label: 'Stop the current reaction',
        kind: 'Action',
        keywords: 'cancel',
        disabled: !connected,
        run: () => {
          send({ type: 'cancel' });
        },
      },
      {
        id: 'copy-overlay',
        label: 'Copy the overlay link',
        kind: 'Action',
        keywords: 'obs browser source url',
        run: () => {
          // Outside a secure context there is no clipboard; Settings shows the link to copy.
          const clipboard = navigator.clipboard as Clipboard | undefined;
          if (!clipboard) {
            openSettings('connections');
            return;
          }
          void clipboard.writeText(overlayUrl).catch(() => {
            openSettings('connections');
          });
        },
      },
      {
        id: 'open-overlay',
        label: 'Open the overlay',
        kind: 'Action',
        keywords: 'preview',
        run: () => {
          window.open(overlayUrl, '_blank', 'noreferrer');
        },
      },
      ...quickCues.map((entry, i): PaletteCommand => ({
        id: `cue-${String(i)}`,
        label: entry.label,
        kind: 'Reaction',
        keywords: entry.doing,
        disabled: away || !supports(character, entry.cue),
        run: () => {
          send({
            type: 'perform',
            ...entry.cue,
            ...(entry.target ? { target: entry.target } : {}),
          });
        },
      })),
      ...offeredSchemes(season).map((entry): PaletteCommand => ({
        id: `theme-${entry.id}`,
        label: `Theme: ${entry.label}`,
        kind: 'Theme',
        keywords: `colour color scheme ${entry.note}`,
        run: () => {
          pickTheme(chooseScheme(theme, entry.id, season));
        },
      })),
      ...toneChoices.map((entry): PaletteCommand => ({
        id: `tone-${entry.id}`,
        label: `Appearance: ${entry.label}`,
        kind: 'Theme',
        keywords: 'light dark mode theme',
        run: () => {
          pickTheme({ ...theme, tone: entry.id });
        },
      })),
    ];
  }, [
    connected,
    state.quiet,
    state.retracted,
    character,
    send,
    overlayUrl,
    goMode,
    openSettings,
    goWelcome,
    pickTheme,
    theme,
    season,
  ]);

  return (
    <LayerContext.Provider value={root}>
      <div className="studio sn" data-theme={scheme.id} data-tone={tone} style={vars} ref={setRoot}>
        <a
          className="st-skip"
          href="#studio-main"
          onClick={(event) => {
            // Move focus without replacing the route in the address.
            event.preventDefault();
            document.getElementById('studio-main')?.focus();
          }}
        >
          Skip to content
        </a>
        {route.place === 'stage' ? (
          <Stage
            {...props}
            mode={route.mode}
            onMode={goMode}
            progress={progress}
            {...(holiday ? { holiday } : {})}
            onSettings={() => {
              openSettings('connections');
            }}
            onWelcome={goWelcome}
            onPalette={() => {
              setPalette(true);
            }}
            onRehearse={() => {
              setRehearse((open) => !open);
            }}
          />
        ) : (
          <Wizard
            {...props}
            progress={progress}
            onProgress={updateProgress}
            onDone={() => {
              goMode('live');
            }}
          />
        )}
        {root ? (
          <>
            <Rehearse {...props} open={rehearse && onStage} onOpenChange={setRehearse} />
            <Settings
              {...props}
              section={settings}
              onSection={openSettings}
              onClose={() => {
                goMode(mode);
              }}
              onWelcome={goWelcome}
              progress={progress}
              onProgress={updateProgress}
              theme={theme}
              tone={tone}
              season={season}
              onTheme={pickTheme}
            />
            <Palette open={palette} onOpenChange={setPalette} commands={commands} />
          </>
        ) : null}
      </div>
    </LayerContext.Provider>
  );
}
