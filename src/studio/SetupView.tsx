import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowUpRight, Check, ChevronDown, Copy } from 'lucide-react';
import { TwitchPanel } from '../TwitchPanel';
import { SceneEditor } from '../StatesPanel';
import { anchorPoint } from '../../shared/attention';
import { anchors, movementStyles, type AnchorId } from '../../shared/locomotion';
import { choreographies, choreographyIds } from '../../shared/presence';
import type { Config } from '../../shared/protocol';
import type { StudioProps } from './types';
import { Card, SwitchRow } from './parts';
import { judgingDockUrl, useOverlayUrl } from '../judging/Session';

// Setup: getting her onto a stream, once. Three steps (make her yours, add her to OBS, let her
// hear chat), an optional OBS dock, and where she hangs out. The service cannot see OBS, so the
// streamer ticks the OBS step off themselves.

export type SetupProgress = { look: boolean; obs: boolean; chat: boolean; dock: boolean };

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(
    () => () => {
      clearTimeout(timer.current);
    },
    [],
  );
  return (
    <div className="st-copy">
      <input
        value={value}
        readOnly
        aria-label={label}
        onFocus={(event) => {
          event.target.select();
        }}
      />
      <button
        type="button"
        className="st-button st-primary"
        aria-label={`Copy ${label.toLowerCase()}`}
        onClick={() => {
          navigator.clipboard.writeText(value).then(
            () => {
              setCopied(true);
              setFailed(false);
              clearTimeout(timer.current);
              timer.current = setTimeout(() => {
                setCopied(false);
              }, 2000);
            },
            () => {
              setFailed(true);
            },
          );
        }}
      >
        {copied ? <Check size={16} /> : <Copy size={16} />}
        {copied ? 'Copied' : 'Copy'}
      </button>
      {failed ? <p className="st-note">Copying was blocked: select the link and copy it.</p> : null}
    </div>
  );
}

function Step({
  number,
  done,
  current,
  title,
  tag,
  children,
}: {
  number: number;
  done: boolean;
  current: boolean;
  title: string;
  tag?: string;
  children: ReactNode;
}) {
  return (
    <li className="st-step" data-done={done || undefined} data-current={current || undefined}>
      <span className="st-step-num" aria-hidden="true">
        {done ? <Check /> : number}
      </span>
      <div className="st-step-body">
        <div className="st-step-head">
          <h2>
            {title}
            {done ? <span className="st-sr"> (done)</span> : null}
          </h2>
          {tag ? <span className="st-tag">{tag}</span> : null}
        </div>
        {children}
      </div>
    </li>
  );
}

export function SetupView({
  state,
  connected,
  send,
  progress,
  onProgress,
  onOpenLook,
}: StudioProps & {
  progress: SetupProgress;
  onProgress: (change: Partial<SetupProgress>) => void;
  onOpenLook: () => void;
}) {
  const overlayUrl = useOverlayUrl();
  const c = state.config;
  const patch = (value: Partial<Config>) => {
    send({ type: 'configure', patch: value });
  };
  const anchor = (value: AnchorId) => {
    const point = anchorPoint(value, c.scene);
    patch({ anchor: value, x: point.x, y: point.y });
  };
  const position = state.performance.body?.spot?.approach ??
    state.performance.movement?.to ?? { x: c.x, y: c.y };
  const current = !progress.look ? 1 : !progress.obs ? 2 : !progress.chat ? 3 : 0;

  return (
    <div className="st-cols">
      <ol className="st-steps st-col-main">
        <Step number={1} done={progress.look} current={current === 1} title="Make her yours">
          <p>
            {progress.look
              ? `${c.name}, ${c.personality}. You can change anything, any time.`
              : 'Pick her look and name. It takes a minute, and you can change it later.'}
          </p>
          <div>
            <button type="button" className="st-button" onClick={onOpenLook}>
              {progress.look ? 'Change her look' : 'Open Look'}
            </button>
          </div>
        </Step>

        <Step
          number={2}
          done={progress.obs}
          current={current === 2}
          title="Add her to OBS"
          tag="About a minute"
        >
          <ol className="st-how">
            <li>
              <span>
                In OBS, under <b>Sources</b>, click <b>+</b> and choose <b>Browser</b>.
              </span>
            </li>
            <li>
              <span>
                Paste this link into the <b>URL</b> box.
              </span>
            </li>
            <li>
              <span>
                Set the size to <b>1280 × 720</b> and click <b>OK</b>.
              </span>
            </li>
          </ol>
          <CopyField label="Overlay link" value={overlayUrl} />
          <div className="st-inline">
            <button
              type="button"
              className="st-button"
              aria-pressed={progress.obs}
              onClick={() => {
                onProgress({ obs: !progress.obs });
              }}
            >
              <Check size={16} /> {progress.obs ? 'Added' : 'I’ve added her'}
            </button>
            <a className="st-link" href={overlayUrl} target="_blank" rel="noreferrer">
              Preview the overlay <ArrowUpRight size={14} />
            </a>
          </div>
          <p className="st-note">
            Keep Tavi running while you stream. Studio themes never show on stream.
          </p>
        </Step>

        <Step
          number={3}
          done={progress.chat}
          current={current === 3}
          title="Let her hear chat"
          tag="Optional"
        >
          <TwitchPanel
            serviceConnected={connected}
            onPhase={(phase) => {
              if (phase === 'connected' && !progress.chat) onProgress({ chat: true });
            }}
          />
        </Step>

        <Step
          number={4}
          done={progress.dock}
          current={false}
          title="Control her from OBS"
          tag="Optional"
        >
          <p>
            Add a small Tavi panel inside OBS, so you can make her react without leaving it. In OBS,
            open <b>Docks</b> › <b>Custom Browser Docks</b>, name it Tavi and paste this link.
          </p>
          <CopyField label="Dock link" value={judgingDockUrl()} />
          <div className="st-inline">
            <button
              type="button"
              className="st-button"
              aria-pressed={progress.dock}
              onClick={() => {
                onProgress({ dock: !progress.dock });
              }}
            >
              <Check size={16} /> {progress.dock ? 'Added' : 'I’ve added it'}
            </button>
            <a className="st-link" href="/dock" target="_blank" rel="noreferrer">
              Open the dock <ArrowUpRight size={14} />
            </a>
          </div>
        </Step>
      </ol>

      <aside className="st-col-side st-stack">
        <Card title="Where she hangs out">
          <div className="st-choices" role="radiogroup" aria-label="Favorite perch">
            {(Object.keys(anchors) as AnchorId[]).map((id) => (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={c.anchor === id}
                className="st-choice"
                disabled={!connected}
                onClick={() => {
                  anchor(id);
                }}
              >
                {anchors[id].label}
              </button>
            ))}
          </div>
          <p className="st-note">Or drag her anywhere on the Live preview.</p>
          <span className="st-label" id="movement-label">
            Getting around
          </span>
          <div className="st-choices" role="radiogroup" aria-labelledby="movement-label">
            {movementStyles.map((id) => (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={c.movementStyle === id}
                className="st-choice"
                disabled={!connected}
                onClick={() => {
                  patch({ movementStyle: id });
                }}
              >
                {id === 'auto' ? 'Her choice' : id.charAt(0).toUpperCase() + id.slice(1)}
              </button>
            ))}
          </div>
          <span className="st-label" id="presence-label">
            Coming and going
          </span>
          <div className="st-choices" role="radiogroup" aria-labelledby="presence-label">
            {(['random', ...choreographyIds] as const).map((id) => (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={c.presenceStyle === id}
                className="st-choice"
                disabled={!connected}
                onClick={() => {
                  patch({ presenceStyle: id });
                }}
              >
                {id === 'random' ? 'Surprise me' : choreographies[id].label}
              </button>
            ))}
          </div>
        </Card>

        <Card title="Captions">
          <SwitchRow
            title="On stream"
            detail="A short line under her when she reacts"
            checked={c.captions.overlay}
            disabled={!connected}
            onChange={(overlay) => {
              patch({ captions: { ...c.captions, overlay } });
            }}
          />
          <SwitchRow
            title="In Studio"
            checked={c.captions.studio}
            disabled={!connected}
            onChange={(studio) => {
              patch({ captions: { ...c.captions, studio } });
            }}
          />
        </Card>

        <details className="st-card st-more st-layout">
          <summary>
            Match your stream layout <ChevronDown size={16} aria-hidden="true" />
          </summary>
          <p className="st-note">
            Show her where your webcam, game and chat sit, so she can perch, sit and look at the
            right places.
          </p>
          <SceneEditor
            config={c}
            send={send}
            connected={connected}
            body={state.performance.body}
            position={position}
          />
        </details>
      </aside>
    </div>
  );
}
