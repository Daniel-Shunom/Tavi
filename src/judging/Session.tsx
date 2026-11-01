import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import {
  judgingSessionSchema,
  JUDGING_WARNING_MS,
  type JudgingSession,
} from '../../shared/judging';
import { Avatar } from '../renderer/Avatar';
import { initialState } from '../../shared/protocol';
import { fetchService, isJudgingSession, sessionUrl } from './transport';
import '../studio.css';
import './judging.css';

const SessionContext = createContext<JudgingSession | null>(null);
export function useJudgingSession() {
  return useContext(SessionContext);
}
export function useOverlayUrl() {
  return useJudgingSession()?.overlayUrl ?? `${location.origin}/overlay`;
}
async function action(path: string) {
  const response = await fetchService(path, {
    method: 'POST',
    headers: { 'x-tavi-request': 'studio' },
    cache: 'no-store',
  });
  const body: unknown = await response.json();
  if (!response.ok)
    throw new Error(
      body && typeof body === 'object' && 'error' in body
        ? String(body.error)
        : 'Preview could not connect. Try again.',
    );
  return body;
}
const portrait = initialState();
export function JudgeStart() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function start() {
    setBusy(true);
    setError('');
    try {
      const body = (await action('/api/judging/sessions')) as { studioUrl: string };
      const url = new URL(body.studioUrl);
      if (url.origin !== location.origin)
        throw new Error('Preview origin does not match this site.');
      location.assign(url.href);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Try again shortly.');
      setBusy(false);
    }
  }
  return (
    <main className="studio st-welcome judge-start" data-theme="moonlight">
      <div className="st-welcome-card">
        <div className="st-welcome-figure portrait-space" aria-hidden="true">
          <Avatar state={portrait} serverNow={Date.now} presentation="portrait" captions={false} />
        </div>
        <div className="st-welcome-body">
          <span className="st-brand">
            tavi <small>Studio preview</small>
          </span>
          <h1>Meet your stream companion.</h1>
          <p className="st-welcome-lede">Your own Tavi. 30 minutes to explore.</p>
          <button
            className="st-button st-primary st-wide"
            disabled={busy}
            onClick={() => void start()}
          >
            {busy ? 'Starting preview…' : 'Start preview'}
          </button>
          {error && (
            <p className="st-welcome-error" role="alert">
              {error}
            </p>
          )}
          <p className="st-welcome-fine">
            Twitch is optional. Test reactions use rules. Changes are temporary.
          </p>
          <a className="st-link" href="/download">
            Get the desktop app
          </a>
        </div>
      </div>
    </main>
  );
}

export function SessionBoundary({ children }: { children: ReactNode }) {
  const [metadata, setMetadata] = useState<JudgingSession | null>(null);
  const [now, setNow] = useState(Date.now);
  const [ended, setEnded] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const enabled = isJudgingSession();
  const overlay = location.pathname === '/overlay';
  useEffect(() => {
    if (!enabled) return;
    const lifetime = new AbortController();
    const stopped = () => lifetime.signal.aborted;
    let clockOffset = 0;
    async function refresh() {
      try {
        const response = await fetchService('/api/judging/session', {
          cache: 'no-store',
          signal: lifetime.signal,
        });
        if (stopped()) return;
        if ([401, 410].includes(response.status)) {
          setEnded(true);
          return;
        }
        if (!response.ok) throw new Error('Preview is reconnecting.');
        const meta = judgingSessionSchema.parse(await response.json());
        if (stopped()) return;
        setMetadata((current) =>
          current && (current.epoch > meta.epoch || current.expiresAt > meta.expiresAt)
            ? current
            : meta,
        );
        clockOffset = meta.serverNow - Date.now();
        setNow(meta.serverNow);
        setError('');
      } catch {
        if (!stopped()) setError('Preview is reconnecting.');
      }
    }
    void refresh();
    const poll = setInterval(() => void refresh(), 15000);
    const tick = setInterval(() => {
      setNow(Date.now() + clockOffset);
    }, 1000);
    return () => {
      lifetime.abort();
      clearInterval(poll);
      clearInterval(tick);
    };
  }, [enabled]);
  if (!enabled) return children;
  const remaining = metadata ? Math.max(0, metadata.expiresAt - now) : 0;
  if (ended || (metadata && remaining === 0)) {
    if (overlay) return null;
    return (
      <main className="judge-message">
        <h1>Preview ended</h1>
        <a href="/judge">Start a new preview</a>
      </main>
    );
  }
  if (!metadata)
    return overlay ? null : (
      <main className="judge-message" role="status">
        {error || 'Starting your preview…'}
      </main>
    );
  async function run(path: string) {
    setBusy(true);
    setError('');
    try {
      setMetadata(judgingSessionSchema.parse(await action(path)));
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Try again shortly.');
    } finally {
      setBusy(false);
    }
  }
  const minutes = Math.ceil(remaining / 1000);
  const timer = `${String(Math.floor(minutes / 60))}:${String(minutes % 60).padStart(2, '0')}`;
  return (
    <SessionContext value={metadata}>
      <div className={overlay ? undefined : 'judge-shell'}>
        {!overlay && (
          <aside className="studio judge-bar" data-theme="moonlight" aria-label="Preview session">
            <span>
              Preview <time>{timer}</time>
            </span>
            {remaining <= JUDGING_WARNING_MS && (
              <span role="status">Five minutes or less remaining</span>
            )}
            {metadata.role === 'controller' && (
              <>
                <button
                  disabled={busy || !metadata.canExtend}
                  onClick={() => void run('/api/judging/extend')}
                >
                  {metadata.canExtend ? 'Add 15 min' : 'Extension used'}
                </button>
                <button disabled={busy} onClick={() => void run('/api/judging/reset')}>
                  Reset preview
                </button>
              </>
            )}
            {error && <span role="alert">{error}</span>}
          </aside>
        )}
        <div key={metadata.epoch} className={overlay ? undefined : 'judge-workspace'}>
          {children}
        </div>
        {overlay && metadata.lastTestEvent && now - metadata.lastTestEvent.at < 30000 && (
          <span className="judge-test-label">Last test · {metadata.lastTestEvent.label}</span>
        )}
      </div>
    </SessionContext>
  );
}
export function judgingDockUrl() {
  return sessionUrl('/dock');
}
