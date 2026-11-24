import type { ReactNode } from 'react';
import { Dialog } from '@base-ui/react/dialog';
import { Tabs } from '@base-ui/react/tabs';
import { ArrowUpRight, LayoutTemplate, Plug, SlidersHorizontal, X } from 'lucide-react';
import { AiPanel } from '../AiPanel';
import { SceneEditor } from '../StatesPanel';
import { TwitchPanel } from '../TwitchPanel';
import { YoutubePanel } from '../YoutubePanel';
import { judgingDockUrl, useOverlayUrl } from '../judging/Session';
import { anchorPoint } from '../../shared/attention';
import { anchors, movementStyles, type AnchorId } from '../../shared/locomotion';
import { choreographies, choreographyIds } from '../../shared/presence';
import type { Config } from '../../shared/protocol';
import type { StudioProps } from '../studio/types';
import { sections, stepsDone, type Section, type SetupProgress } from './model';
import type { HolidayId } from './holiday/calendar';
import { ThemePicker } from './ThemePicker';
import type { ThemeChoice, Tone } from './themes';
import { Choices, CopyField, ToggleRow, useLayer } from './ui';

// Settings: everything set once, in a panel over the stage. Connections, the stream layout and a
// few preferences. The guided setup can be run again from here.

const sectionInfo: Record<Section, { label: string; icon: ReactNode }> = {
  connections: { label: 'Connections', icon: <Plug /> },
  layout: { label: 'Stream layout', icon: <LayoutTemplate /> },
  preferences: { label: 'Preferences', icon: <SlidersHorizontal /> },
};

export function Settings({
  state,
  connected,
  send,
  section,
  onSection,
  onClose,
  onWelcome,
  progress,
  onProgress,
  theme,
  tone,
  season,
  onTheme,
}: StudioProps & {
  /** The open section, or null when Settings is closed. */
  section: Section | null;
  onSection: (section: Section) => void;
  onClose: () => void;
  onWelcome: () => void;
  progress: SetupProgress;
  onProgress: (change: Partial<SetupProgress>) => void;
  theme: ThemeChoice;
  /** The tone showing now (resolved from the choice and the computer). */
  tone: Tone;
  /** The holiday in season, if any. */
  season: HolidayId | null;
  onTheme: (theme: ThemeChoice) => void;
}) {
  const layer = useLayer();
  const overlayUrl = useOverlayUrl();
  const c = state.config;
  const patch = (value: Partial<Config>) => {
    send({ type: 'configure', patch: value });
  };
  const position = state.performance.body?.spot?.approach ??
    state.performance.movement?.to ?? { x: c.x, y: c.y };
  const heard = (phase: string) => {
    if (phase === 'connected' && !progress.chat) onProgress({ chat: true });
  };

  return (
    <Dialog.Root
      open={section !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Dialog.Portal container={layer}>
        <Dialog.Backdrop className="sn-backdrop" />
        <Dialog.Popup className="sn-settings">
          <Tabs.Root
            className="sn-settings-tabs"
            orientation="vertical"
            value={section ?? 'connections'}
            onValueChange={(next) => {
              onSection(next as Section);
            }}
          >
            <div className="sn-settings-side">
              <Dialog.Title className="sn-serif">Settings</Dialog.Title>
              <Tabs.List className="sn-settings-nav" aria-label="Settings sections">
                {sections.map((id) => (
                  <Tabs.Tab key={id} value={id} className="sn-settings-tab">
                    {sectionInfo[id].icon}
                    {sectionInfo[id].label}
                  </Tabs.Tab>
                ))}
              </Tabs.List>
              <button type="button" className="sn-btn sn-settings-again" onClick={onWelcome}>
                {stepsDone(progress) < 3 ? 'Finish setup' : 'Run setup again'}
              </button>
            </div>

            <div className="sn-settings-body">
              <Dialog.Close className="sn-icon-btn sn-settings-close" aria-label="Close Settings">
                <X size={18} aria-hidden="true" />
              </Dialog.Close>

              <Tabs.Panel value="connections" className="sn-settings-panel">
                <header className="sn-room-head">
                  <h2>Connections</h2>
                  <p>Where she is, and who she can hear.</p>
                </header>
                <section className="st-card" aria-labelledby="conn-overlay">
                  <div className="st-card-head">
                    <h3 id="conn-overlay">OBS overlay</h3>
                    <span className="sn-tag">{progress.obs ? 'She’s in' : 'Not yet'}</span>
                  </div>
                  <p className="sn-hint">The link for a Browser source in OBS, sized 1280 × 720.</p>
                  <CopyField label="Overlay link" value={overlayUrl} />
                  <ToggleRow
                    title="She’s in my OBS scene"
                    checked={progress.obs}
                    onChange={(obs) => {
                      onProgress({ obs });
                    }}
                  />
                  <a className="st-link" href={overlayUrl} target="_blank" rel="noreferrer">
                    Preview the overlay <ArrowUpRight size={14} aria-hidden="true" />
                  </a>
                </section>
                <section className="st-card st-platform-connections" aria-label="Chat">
                  <TwitchPanel serviceConnected={connected} onPhase={heard} />
                  <YoutubePanel serviceConnected={connected} onPhase={heard} />
                </section>
                <section className="st-card" aria-labelledby="conn-dock">
                  <div className="st-card-head">
                    <h3 id="conn-dock">OBS dock</h3>
                    <span className="sn-tag">Optional</span>
                  </div>
                  <p className="sn-hint">
                    A small Tavi panel inside OBS, so you can cue her without leaving OBS. Open
                    Docks › Custom Browser Docks, name it Tavi and paste this link.
                  </p>
                  <CopyField label="Dock link" value={judgingDockUrl()} />
                  <ToggleRow
                    title="The dock is in OBS"
                    checked={progress.dock}
                    onChange={(dock) => {
                      onProgress({ dock });
                    }}
                  />
                </section>
              </Tabs.Panel>

              <Tabs.Panel value="layout" className="sn-settings-panel">
                <header className="sn-room-head">
                  <h2>Stream layout</h2>
                  <p>
                    Show her where your game, webcam and chat sit, so she perches, sits and looks in
                    the right places.
                  </p>
                </header>
                <section className="st-card" aria-label="Scene layout">
                  <SceneEditor
                    config={c}
                    send={send}
                    connected={connected}
                    body={state.performance.body}
                    position={position}
                  />
                </section>
                <section className="st-card" aria-label="How she uses the scene">
                  <div className="sn-group">
                    <span className="sn-label">Where she hangs out</span>
                    <Choices
                      label="Where she hangs out"
                      options={(Object.keys(anchors) as AnchorId[]).map((id) => ({
                        id,
                        label: anchors[id].label,
                      }))}
                      value={c.anchor}
                      disabled={!connected}
                      onPick={(anchor) => {
                        const point = anchorPoint(anchor, c.scene);
                        patch({ anchor, x: point.x, y: point.y });
                      }}
                    />
                    <p className="sn-hint">Or drag her spot anywhere on the stage.</p>
                  </div>
                  <div className="sn-group">
                    <span className="sn-label">Getting around</span>
                    <Choices
                      label="Getting around"
                      options={movementStyles.map((id) => ({
                        id,
                        label:
                          id === 'auto' ? 'Her choice' : id.charAt(0).toUpperCase() + id.slice(1),
                      }))}
                      value={c.movementStyle}
                      disabled={!connected}
                      onPick={(movementStyle) => {
                        patch({ movementStyle });
                      }}
                    />
                  </div>
                  <div className="sn-group">
                    <span className="sn-label">Coming and going</span>
                    <Choices
                      label="Coming and going"
                      options={(['random', ...choreographyIds] as const).map((id) => ({
                        id,
                        label: id === 'random' ? 'Her choice' : choreographies[id].label,
                      }))}
                      value={c.presenceStyle}
                      disabled={!connected}
                      onPick={(presenceStyle) => {
                        patch({ presenceStyle });
                      }}
                    />
                  </div>
                </section>
              </Tabs.Panel>

              <Tabs.Panel value="preferences" className="sn-settings-panel">
                <header className="sn-room-head">
                  <h2>Preferences</h2>
                  <p>Small things you set once.</p>
                </header>
                <section className="st-card" aria-labelledby="pref-captions">
                  <h3 id="pref-captions">Captions</h3>
                  <div>
                    <ToggleRow
                      title="On stream"
                      detail="A short line under her when she reacts"
                      checked={c.captions.overlay}
                      disabled={!connected}
                      onChange={(overlay) => {
                        patch({ captions: { ...c.captions, overlay } });
                      }}
                    />
                    <ToggleRow
                      title="In Studio"
                      detail="Only you see these"
                      checked={c.captions.studio}
                      disabled={!connected}
                      onChange={(studio) => {
                        patch({ captions: { ...c.captions, studio } });
                      }}
                    />
                  </div>
                </section>
                <section className="st-card" aria-labelledby="pref-theme">
                  <h3 id="pref-theme">Theme</h3>
                  <p className="sn-hint">Only Studio changes. Nothing here shows on stream.</p>
                  <ThemePicker theme={theme} tone={tone} season={season} onTheme={onTheme} />
                </section>
                <section className="st-card st-brain" aria-labelledby="pref-brain">
                  <h3 id="pref-brain">How she decides</h3>
                  <AiPanel serviceConnected={connected} />
                  <p className="sn-hint">
                    Keys stay with the local service and never reach Studio or the overlay. Chat is
                    treated as untrusted text.
                  </p>
                </section>
              </Tabs.Panel>
            </div>
          </Tabs.Root>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
