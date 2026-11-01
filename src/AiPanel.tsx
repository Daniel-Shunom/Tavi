import { useCallback, useEffect, useState } from 'react';
import { Brain, Check, CircleAlert } from 'lucide-react';
import {
  aiStatusSchema,
  chatgptStatusSchema,
  providerIds,
  type AiStatus,
  type ChatGPTStatus,
} from '../shared/ai';
import { fetchService, isJudgingSession } from './judging/transport';

/** Chooses which decision provider directs expressions. Keys stay on the service. */
export function AiPanel({ serviceConnected }: { serviceConnected: boolean }) {
  const [status, setStatus] = useState<AiStatus | null>(null);
  const [provider, setProvider] = useState<(typeof providerIds)[number]>('rules');
  const [model, setModel] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [dirty, setDirty] = useState(false);
  const [account, setAccount] = useState<ChatGPTStatus | null>(null);
  const [authorizationUrl, setAuthorizationUrl] = useState('');
  const read = useCallback(async () => {
    const response = await fetchService('/api/ai', { cache: 'no-store' });
    if (!response.ok) throw new Error('Could not read AI status.');
    return aiStatusSchema.parse(await response.json());
  }, []);
  useEffect(() => {
    if (!serviceConnected) return;
    let disposed = false;
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try {
        const [next, accountResponse] = await Promise.all([
          read(),
          isJudgingSession() ? Promise.resolve(null) : fetch('/api/chatgpt', { cache: 'no-store' }),
        ]);
        const nextAccount = accountResponse
          ? chatgptStatusSchema.parse(await accountResponse.json())
          : null;
        if (!disposed) {
          setStatus(next);
          if (nextAccount) {
            setAccount(nextAccount);
            if (nextAccount.phase !== 'authorizing') setAuthorizationUrl('');
          }
          setError('');
        }
      } catch {
        if (!disposed) setError('AI status is unavailable. Check the local service.');
      } finally {
        if (!disposed)
          timer = setTimeout(() => {
            void poll();
          }, 3000);
      }
    }
    void poll();
    return () => {
      disposed = true;
      clearTimeout(timer);
    };
  }, [serviceConnected, read]);
  useEffect(() => {
    if (!status || dirty) return;
    const active = providerIds.find((id) => id === status.active.id) ?? 'rules';
    setProvider(active);
    setModel(status.providers.find((entry) => entry.id === active)?.model ?? '');
  }, [status, dirty]);
  async function apply() {
    setBusy(true);
    setError('');
    try {
      const response = await fetchService('/api/ai', {
        method: 'POST',
        headers: { 'x-tavi-request': 'studio', 'content-type': 'application/json' },
        body: JSON.stringify(
          provider === 'rules' || !model.trim() ? { provider } : { provider, model: model.trim() },
        ),
      });
      if (!response.ok) throw new Error('Selection rejected.');
      setStatus(aiStatusSchema.parse(await response.json()));
      setDirty(false);
    } catch {
      setError('Could not switch the decision provider. Check the model name.');
    } finally {
      setBusy(false);
    }
  }
  const chosen = status?.providers.find((entry) => entry.id === provider);
  async function accountAction(action: 'connect' | 'disconnect') {
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/chatgpt/' + action, {
        method: 'POST',
        headers: { 'x-tavi-request': 'studio' },
      });
      if (!response.ok) throw new Error('Account action failed.');
      if (action === 'connect') {
        const result = (await response.json()) as { authorizationUrl: string };
        const url = new URL(result.authorizationUrl);
        if (url.origin !== 'https://auth.openai.com' || url.pathname !== '/api/accounts/authorize')
          throw new Error('Invalid authorization URL.');
        setAuthorizationUrl(url.href);
        window.open(url.href, '_blank', 'noopener,noreferrer');
      } else {
        setAccount(chatgptStatusSchema.parse(await response.json()));
        setAuthorizationUrl('');
      }
      setStatus(await read());
      setDirty(false);
      const fresh = await fetch('/api/chatgpt', { cache: 'no-store' });
      setAccount(chatgptStatusSchema.parse(await fresh.json()));
    } catch {
      setError('Could not update ChatGPT. Disconnect and try again.');
    } finally {
      setBusy(false);
    }
  }
  const isAi = status?.active.kind === 'ai';
  return (
    <div className="ai-panel">
      {!isJudgingSession() ? (
        <div className="chatgpt-account">
          <p className="helper-note" role="status">
            {account?.phase === 'connected'
              ? account.email
              : account?.phase === 'authorizing'
                ? 'Finish sign-in in your browser.'
                : 'Power Tavi with your ChatGPT plan.'}
          </p>
          {account?.phase !== 'connected' && account?.phase !== 'authorizing' ? (
            <button
              type="button"
              className="primary-button"
              disabled={!serviceConnected || busy}
              onClick={() => void accountAction('connect')}
            >
              Continue with ChatGPT
            </button>
          ) : null}
          {account?.phase === 'authorizing' && authorizationUrl ? (
            <a
              className="primary-button"
              href={authorizationUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              Open sign-in
            </a>
          ) : null}
          {account?.phase === 'connected' ||
          account?.phase === 'authorizing' ||
          account?.phase === 'error' ? (
            <button
              type="button"
              className="small-button"
              disabled={!serviceConnected || busy}
              onClick={() => void accountAction('disconnect')}
            >
              {account.phase === 'authorizing' ? 'Cancel sign-in' : 'Disconnect ChatGPT'}
            </button>
          ) : null}
          <p className="helper-note">
            Uses your plan allowance. Selected chat context goes to OpenAI.
          </p>
          {account?.error ? (
            <p className="error-banner" role="alert">
              {account.error}
            </p>
          ) : null}
        </div>
      ) : null}
      <p className="ai-active" role="status">
        <Brain size={15} />
        <span>
          Directing expressions: <strong>{status ? status.active.label : 'checking...'}</strong>
        </span>
        <span className={`ai-badge ${isAi ? 'live' : ''}`}>{isAi ? 'AI' : 'Not AI'}</span>
      </p>
      <fieldset disabled={!serviceConnected || busy} className="ai-controls">
        <label className="field">
          Decision provider
          <select
            value={provider}
            onChange={(event) => {
              const next = providerIds.find((id) => id === event.target.value) ?? 'rules';
              setProvider(next);
              setModel(status?.providers.find((entry) => entry.id === next)?.model ?? '');
              setDirty(true);
            }}
          >
            {(
              status?.providers ?? [
                { id: 'rules' as const, label: 'Rules (not AI)', configured: true },
              ]
            ).map((entry) => (
              <option key={entry.id} value={entry.id} disabled={!entry.configured}>
                {entry.label}
                {entry.configured ? '' : ' (not configured)'}
              </option>
            ))}
          </select>
        </label>
        {provider === 'chatgpt' ? (
          <label className="field">
            Model
            <select
              name="ai-model"
              value={model}
              onChange={(event) => {
                setModel(event.target.value);
                setDirty(true);
              }}
            >
              {account?.models.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.name}
                </option>
              ))}
            </select>
          </label>
        ) : provider !== 'rules' ? (
          <label className="field">
            Model
            <input
              name="ai-model"
              autoComplete="off"
              spellCheck={false}
              value={model}
              maxLength={120}
              onChange={(event) => {
                setModel(event.target.value);
                setDirty(true);
              }}
            />
          </label>
        ) : null}
        <button
          className="primary-button"
          type="button"
          disabled={!dirty}
          onClick={() => void apply()}
        >
          <Check size={15} />
          Use this
        </button>
      </fieldset>
      {chosen && !chosen.configured && chosen.hint ? (
        <p className="helper-note">{chosen.hint}</p>
      ) : null}
      <details className="ai-connections">
        <summary>Account connection options</summary>
        <ul>
          {status?.connections.map((connection) => (
            <li key={connection.id}>
              <span className="ai-connection-title">
                {connection.label} <span className="ai-badge">{connection.method}</span>
              </span>
              <span className="ai-connection-detail">
                {connection.detail}
                {connection.availability === 'setup-required' ? ' (not connected yet)' : ''}
              </span>
            </li>
          ))}
        </ul>
      </details>
      {status?.last ? (
        <p className="helper-note">
          Last decision: {status.last.by.label}, {status.last.outcome.replace('-', ' ')} in{' '}
          {Math.round(status.last.latencyMs)} ms{status.last.error ? ` (${status.last.error})` : ''}
          . AI calls this session: {status.calls}, {status.budget.remainingSession} left.
        </p>
      ) : null}
      {error ? (
        <p className="error-banner" role="alert">
          <CircleAlert size={14} /> {error}
        </p>
      ) : null}
    </div>
  );
}
