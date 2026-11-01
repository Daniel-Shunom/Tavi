import { useCallback, useEffect, useState } from 'react';
import { ArrowRight, Check, ExternalLink } from 'lucide-react';
import { Avatar } from '../renderer/Avatar';
import type { useConnection } from '../useConnection';
import { disconnectedTwitch, twitchStatusSchema, type TwitchStatus } from '../../shared/twitch';
import { fetchService, isJudgingSession } from '../judging/transport';

// The door into Studio: connect Twitch first, or skip and do it later in Setup. Twitch sign-in is
// kept in memory by the service, so a streamer who has connected before sees this again after
// restarting Tavi; one who skipped goes straight in (Setup › Let her hear chat has it later).

const KEY = 'tavi.studio.twitch';
export type TwitchChoice = 'connected' | 'skipped' | null;

export function readTwitchChoice(): TwitchChoice {
  if (isJudgingSession()) return null;
  try {
    const stored = localStorage.getItem(KEY);
    return stored === 'connected' || stored === 'skipped' ? stored : null;
  } catch {
    return null;
  }
}
function rememberChoice(choice: Exclude<TwitchChoice, null>) {
  if (isJudgingSession()) return;
  try {
    localStorage.setItem(KEY, choice);
  } catch {
    // Private windows may refuse storage; Studio just asks again next time.
  }
}

const live = (phase: TwitchStatus['phase']) =>
  phase === 'connecting' || phase === 'connected' || phase === 'reconnecting';

export function Welcome({
  connection,
  theme,
  onDone,
}: {
  connection: ReturnType<typeof useConnection>;
  theme: string;
  onDone: () => void;
}) {
  const { state, connected, serverNow } = connection;
  const returning = readTwitchChoice() === 'connected';
  const [status, setStatus] = useState<TwitchStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const read = useCallback(async () => {
    const response = await fetchService('/api/twitch', { cache: 'no-store' });
    if (!response.ok) throw new Error('Could not read Twitch status.');
    return twitchStatusSchema.parse(await response.json());
  }, []);
  useEffect(() => {
    if (!connected) return;
    let disposed = false;
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try {
        const next = await read();
        if (!disposed) setStatus(next);
      } catch {
        if (!disposed) setError('Twitch is unavailable right now. You can skip and connect later.');
      } finally {
        if (!disposed)
          timer = setTimeout(() => {
            void poll();
          }, 1500);
      }
    }
    void poll();
    return () => {
      disposed = true;
      clearTimeout(timer);
    };
  }, [connected, read]);

  const phase = (status ?? disconnectedTwitch()).phase;
  // Already connected (another Studio tab, or the service kept going): straight in.
  useEffect(() => {
    if (!status || !live(status.phase)) return;
    rememberChoice('connected');
    const timer = setTimeout(onDone, status.phase === 'connected' ? 900 : 1800);
    return () => {
      clearTimeout(timer);
    };
  }, [status, onDone]);

  async function act(value: 'connect' | 'disconnect') {
    setBusy(true);
    setError('');
    try {
      const response = await fetchService('/api/twitch/' + value, {
        method: 'POST',
        headers: { 'x-tavi-request': 'studio' },
      });
      if (!response.ok) throw new Error('Twitch action failed.');
      setStatus(twitchStatusSchema.parse(await response.json()));
    } catch {
      setError('Could not reach Twitch. Try again, or skip and connect later.');
    } finally {
      setBusy(false);
    }
  }

  const authorization = status?.authorization;
  const problem = error || status?.error;

  return (
    <div className="studio st-welcome" data-theme={theme}>
      <main className="st-welcome-card">
        <div className="st-welcome-figure portrait-space" aria-hidden="true">
          <Avatar state={state} serverNow={serverNow} presentation="portrait" captions={false} />
        </div>
        <div className="st-welcome-body">
          <span className="st-brand">
            tavi <small>Studio</small>
          </span>
          <h1>{returning ? 'Welcome back' : `Say hi to ${state.config.name}`}</h1>
          <p className="st-welcome-lede">
            {returning
              ? 'Reconnect Twitch so she can hear your chat again.'
              : 'Connect your Twitch account so she can hear your chat and react to it on stream.'}
          </p>

          {live(phase) ? (
            <p className="st-welcome-done" role="status">
              <Check size={18} />
              {phase === 'connected'
                ? `Connected${status?.account ? ` as ${status.account.login}` : ''}`
                : 'Connecting to your chat…'}
            </p>
          ) : authorization ? (
            <div className="st-welcome-code">
              <p>Approve Tavi on Twitch. If it asks for a code, enter:</p>
              <strong>{authorization.userCode}</strong>
              <a
                className="st-button st-primary st-twitch st-wide"
                href={authorization.verificationUri}
                target="_blank"
                rel="noreferrer"
              >
                Open Twitch <ExternalLink size={16} />
              </a>
              <p className="st-welcome-wait" role="status">
                Waiting for you to approve…
              </p>
              <button
                type="button"
                className="st-link"
                disabled={busy}
                onClick={() => void act('disconnect')}
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="st-button st-primary st-twitch st-wide"
              disabled={busy || !connected}
              onClick={() => void act('connect')}
            >
              <TwitchMark />
              {!connected ? 'Starting Tavi…' : busy ? 'One moment…' : 'Connect with Twitch'}
            </button>
          )}

          {problem ? (
            <p className="st-welcome-error" role="alert">
              {problem}
            </p>
          ) : null}

          {live(phase) ? (
            <button type="button" className="st-button st-wide" onClick={onDone}>
              Open Studio <ArrowRight size={16} />
            </button>
          ) : (
            <button
              type="button"
              className="st-link st-welcome-skip"
              onClick={() => {
                if (!returning) rememberChoice('skipped');
                onDone();
              }}
            >
              {returning ? 'Not now' : 'Skip for now'}
            </button>
          )}

          <p className="st-welcome-fine">
            Tavi only reads chat; she never posts. Chat reactions are rules, not AI.
            {returning ? null : ' You can connect any time in Setup.'}
          </p>
        </div>
      </main>
    </div>
  );
}

function TwitchMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
      <path d="M4.3 3 3 6.4v13.4h4.6V22h2.6l2.2-2.2h3.6L21 15.3V3H4.3Zm15 11.4-2.8 2.8H12l-2.2 2.2v-2.2H6V4.7h13.3v9.7ZM16.5 7.9v4.9h-1.7V7.9h1.7Zm-4.5 0v4.9h-1.7V7.9H12Z" />
    </svg>
  );
}
