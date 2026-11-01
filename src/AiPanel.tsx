import { useCallback, useEffect, useState } from 'react';
import { Brain, Check, CircleAlert } from 'lucide-react';
import { aiStatusSchema, providerIds, type AiStatus } from '../shared/ai';
import { fetchService, isJudgingSession } from './judging/transport';

/** Chooses which decision provider directs expressions. Keys stay on the service. */
export function AiPanel({ serviceConnected }: { serviceConnected: boolean }) {
  const [status, setStatus] = useState<AiStatus | null>(null);
  const [provider, setProvider] = useState<(typeof providerIds)[number]>('rules');
  const [model, setModel] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [dirty, setDirty] = useState(false);
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
        const next = await read();
        if (!disposed) {
          setStatus(next);
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
  const isAi = status?.active.kind === 'ai';
  return (
    <div className="ai-panel">
      <p className="ai-active" role="status">
        <Brain size={15} />
        <span>
          Directing expressions: <strong>{status ? status.active.label : 'checking...'}</strong>
        </span>
        <span className={`ai-badge ${isAi ? 'live' : ''}`}>{isAi ? 'AI' : 'Not AI'}</span>
      </p>
      {isJudgingSession() && (
        <p className="helper-note">
          Rules preview. AI connections are available in the desktop app.
        </p>
      )}
      <fieldset disabled={!serviceConnected || busy || isJudgingSession()} className="ai-controls">
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
        {provider !== 'rules' ? (
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
      <details className="ai-connections" hidden={isJudgingSession()}>
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
