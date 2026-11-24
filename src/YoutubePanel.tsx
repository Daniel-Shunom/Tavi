import { useEffect, useRef, useState } from 'react';
import { ExternalLink, Radio, Video } from 'lucide-react';
import { disconnectedYoutube, youtubeStatusSchema, type YoutubeStatus } from '../shared/youtube';
import { fetchService, isJudgingSession } from './judging/transport';

const labels: Record<YoutubeStatus['phase'], string> = {
  disconnected: 'Not connected',
  authorizing: 'Waiting for Google sign-in',
  connecting: 'Connecting to chat',
  waiting: 'Signed in',
  connected: 'Chat connected',
  reconnecting: 'Reconnecting to chat',
  error: 'Connection needs attention',
};
export function YoutubePanel({
  serviceConnected,
  onPhase,
}: {
  serviceConnected: boolean;
  onPhase?: (phase: YoutubeStatus['phase']) => void;
}) {
  const [status, setStatus] = useState<YoutubeStatus>(() => disconnectedYoutube());
  const [busy, setBusy] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [readError, setReadError] = useState('');
  const [actionError, setActionError] = useState('');
  const readVersion = useRef(0);
  const listener = useRef(onPhase);
  useEffect(() => {
    listener.current = onPhase;
  }, [onPhase]);
  useEffect(() => {
    if (confirmed) listener.current?.(status.phase);
  }, [status.phase, confirmed]);
  useEffect(() => {
    if (!serviceConnected) {
      setConfirmed(false);
      return;
    }
    if (busy || isJudgingSession()) return;
    let disposed = false;
    const abort = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    async function read() {
      const version = readVersion.current;
      try {
        const response = await fetchService('/api/youtube', {
          cache: 'no-store',
          signal: abort.signal,
        });
        if (!response.ok) throw new Error('Status unavailable');
        const next = youtubeStatusSchema.parse(await response.json());
        if (!disposed && version === readVersion.current) {
          setStatus(next);
          setConfirmed(true);
          setReadError('');
        }
      } catch {
        if (!disposed && version === readVersion.current)
          setReadError('YouTube status is unavailable. Check the local service.');
      } finally {
        if (!disposed)
          timer = setTimeout(() => {
            void read();
          }, 1500);
      }
    }
    void read();
    return () => {
      disposed = true;
      abort.abort();
      clearTimeout(timer);
    };
  }, [serviceConnected, busy]);
  async function action(action: 'connect' | 'disconnect' | 'select', id?: string) {
    ++readVersion.current;
    setBusy(true);
    setActionError('');
    try {
      const response = await fetchService('/api/youtube/' + action, {
        method: 'POST',
        headers: {
          'x-tavi-request': 'studio',
          ...(id ? { 'Content-Type': 'application/json' } : {}),
        },
        ...(id ? { body: JSON.stringify({ id }) } : {}),
      });
      if (!response.ok) throw new Error('Action failed');
      setStatus(youtubeStatusSchema.parse(await response.json()));
      setConfirmed(true);
    } catch {
      setActionError('Could not update YouTube. Check the local service and try again.');
    } finally {
      setBusy(false);
    }
  }
  const active = status.phase !== 'disconnected' && status.phase !== 'error';
  return (
    <section className="twitch-panel" aria-labelledby="youtube-title">
      <div className="panel-title">
        <h2 id="youtube-title">
          <Video size={16} /> YouTube connection (beta)
        </h2>
        <span
          className={`twitch-phase ${status.phase === 'connected' ? 'online' : ''}`}
          role="status"
        >
          <Radio size={12} />
          {serviceConnected
            ? confirmed
              ? labels[status.phase]
              : readError
                ? 'Status unavailable'
                : 'Checking YouTube connection...'
            : 'Local service disconnected'}
        </span>
      </div>
      <div className="twitch-content">
        <p className="panel-copy">
          Beta: sign in with an approved Google test account, then start a broadcast with live chat
          enabled.
        </p>
        {isJudgingSession() ? (
          <p className="small-print">YouTube is available in the local Tavi app.</p>
        ) : confirmed && serviceConnected && !status.configured ? (
          <p className="small-print">
            YouTube sign-in is not available in this version of Tavi yet. No account setup is needed
            on your computer.
          </p>
        ) : null}
        {status.account ? (
          <p className="channel-name">
            Channel: <strong>{status.account.title}</strong>
          </p>
        ) : null}
        {status.authorization ? (
          <div className="twitch-authorization">
            <p>
              Continue in your system browser, choose your streaming channel and approve read-only
              access.
            </p>
            <a
              className="secondary-button"
              href={status.authorization.url}
              target="_blank"
              rel="noreferrer"
            >
              Sign in with Google <ExternalLink size={14} />
            </a>
            <p>
              Return here after approval. Sign-in expires at{' '}
              {new Date(status.authorization.expiresAt).toLocaleTimeString()}.
            </p>
          </div>
        ) : null}
        {status.phase === 'waiting' ? (
          status.broadcasts.length ? (
            <div>
              <p>Choose the live broadcast Tavi should listen to:</p>
              {status.broadcasts.map((broadcast) => (
                <button
                  key={broadcast.id}
                  type="button"
                  className="secondary-button"
                  disabled={busy || !serviceConnected}
                  onClick={() => {
                    void action('select', broadcast.id);
                  }}
                >
                  {broadcast.title}
                </button>
              ))}
            </div>
          ) : (
            <p role="status">
              Waiting for a live broadcast with chat enabled. Start your stream in YouTube Studio;
              Tavi checks every minute.
            </p>
          )
        ) : null}
        {status.broadcastId ? (
          <p className="channel-name">
            Listening to:{' '}
            <strong>
              {status.broadcasts.find((broadcast) => broadcast.id === status.broadcastId)?.title ??
                'Live broadcast'}
            </strong>
          </p>
        ) : null}
        {actionError || readError || status.error ? (
          <p className="twitch-error" role="alert">
            {actionError || readError || status.error}
          </p>
        ) : null}
        <button
          type="button"
          className="secondary-button"
          disabled={
            busy || !serviceConnected || !confirmed || !status.configured || isJudgingSession()
          }
          onClick={() => {
            void action(active || status.account ? 'disconnect' : 'connect');
          }}
        >
          {busy
            ? 'Please wait...'
            : active || status.account
              ? 'Disconnect YouTube'
              : 'Connect YouTube'}
        </button>
        <p className="small-print twitch-note">
          Address Tavi by name to invite a reaction. Quiet mode and cooldowns apply to both
          platforms. Reconnect after restarting Tavi.
        </p>
        {status.messages.length ? (
          <div className="live-chat" aria-label="Recent YouTube messages">
            <h3>Recent YouTube chat</h3>
            {status.messages.slice(-6).map((message) => (
              <p key={message.id}>
                <strong>{message.author}</strong>
                <span>{message.text}</span>
              </p>
            ))}
          </div>
        ) : status.phase === 'connected' ? (
          <p className="empty-chat">New live messages will appear here.</p>
        ) : null}
      </div>
    </section>
  );
}
