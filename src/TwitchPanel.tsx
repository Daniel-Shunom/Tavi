import { useCallback, useEffect, useState } from 'react';
import { Check, Copy, ExternalLink, MessageCircle, Radio, Unplug } from 'lucide-react';
import { disconnectedTwitch, twitchStatusSchema, type TwitchStatus } from '../shared/twitch';
export function TwitchPanel({ serviceConnected }: { serviceConnected: boolean }) {
  const [status, setStatus] = useState<TwitchStatus>(disconnectedTwitch);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const read = useCallback(async () => {
    const response = await fetch('/api/twitch', { cache: 'no-store' });
    if (!response.ok) throw new Error('Could not read Twitch status.');
    return twitchStatusSchema.parse(await response.json());
  }, []);
  useEffect(() => {
    if (!serviceConnected) return;
    let disposed = false;
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try {
        const next = await read();
        if (!disposed) {
          setStatus(next);
          setError('');
        }
      } catch {
        if (!disposed) setError('Twitch status is unavailable. Check the local service.');
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
  }, [serviceConnected, read]);
  async function action(value: 'connect' | 'disconnect') {
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/twitch/' + value, {
        method: 'POST',
        headers: { 'x-tavi-request': 'studio' },
      });
      if (!response.ok) throw new Error('Twitch action failed.');
      setStatus(twitchStatusSchema.parse(await response.json()));
    } catch {
      setError('Could not update Twitch. Check the local service and try again.');
    } finally {
      setBusy(false);
    }
  }
  async function copy() {
    if (!status.authorization) return;
    try {
      await navigator.clipboard.writeText(status.authorization.verificationUri);
      setCopied(true);
    } catch {
      setError('Copy the authorization link below into your browser.');
    }
  }
  const active = ['connecting', 'connected', 'reconnecting'].includes(status.phase);
  const authorizing = status.phase === 'authorizing';
  const labels = {
    disconnected: 'Not connected',
    authorizing: 'Waiting for authorization',
    connecting: 'Connecting to chat',
    connected: 'Chat connected',
    reconnecting: 'Reconnecting to chat',
    error: 'Connection needs attention',
  };
  return (
    <section className="twitch-panel" aria-labelledby="twitch-title">
      <div className="panel-title">
        <h2 id="twitch-title">
          <MessageCircle size={16} /> Twitch connection
        </h2>
        <span className={`twitch-phase ${status.phase === 'connected' ? 'online' : ''}`}>
          <Radio size={12} />
          {serviceConnected ? labels[status.phase] : 'Local service disconnected'}
        </span>
      </div>
      <div className="twitch-content">
        <p className="panel-copy">
          Connect your streamer account to read your channel's chat. Tavi only listens; it does not
          post replies.
        </p>
        {status.account ? (
          <p className="channel-name">
            Channel: <strong>{status.account.login}</strong>
          </p>
        ) : null}
        {status.authorization ? (
          <div className="twitch-authorization">
            <p>Approve Tavi in your browser. If prompted, enter:</p>
            <strong className="device-code">{status.authorization.userCode}</strong>
            <a
              className="secondary-button"
              href={status.authorization.verificationUri}
              target="_blank"
              rel="noreferrer"
            >
              Authorize on Twitch <ExternalLink size={14} />
            </a>
            <button className="copy-auth" onClick={() => void copy()}>
              {copied ? <Check size={13} /> : <Copy size={13} />}Copy authorization link
            </button>
            <code>{status.authorization.verificationUri}</code>
            <p>
              The code expires at {new Date(status.authorization.expiresAt).toLocaleTimeString()}.
            </p>
          </div>
        ) : null}
        {error || status.error ? (
          <p className="twitch-error" role="alert">
            {error || status.error}
          </p>
        ) : null}
        <button
          className="secondary-button"
          disabled={busy || !serviceConnected}
          onClick={() => void action(active || authorizing ? 'disconnect' : 'connect')}
        >
          {active || authorizing ? <Unplug size={14} /> : <MessageCircle size={14} />}{' '}
          {busy
            ? 'Please wait...'
            : active
              ? 'Disconnect Twitch'
              : authorizing
                ? 'Cancel connection'
                : 'Connect Twitch'}
        </button>
        <p className="small-print twitch-note">
          Address your companion by name or say "Tavi" to invite a reaction. Quiet mode, tuck-away,
          chat engagement, and a 30-90 second cooldown keep reactions restrained. Reconnect after
          restarting Tavi.
        </p>
        {status.messages.length > 0 ? (
          <div className="live-chat" aria-label="Recent Twitch messages">
            <h3>Recent chat</h3>
            {status.messages.slice(-6).map((message) => (
              <p key={message.id}>
                <strong>{message.author}</strong>
                <span>{message.text}</span>
              </p>
            ))}
          </div>
        ) : active ? (
          <p className="empty-chat">Messages will appear here when someone chats.</p>
        ) : null}
      </div>
    </section>
  );
}
