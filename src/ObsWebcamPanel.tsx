import { useEffect, useState } from 'react';
import { obsStatusSchema, type ObsStatus } from '../shared/obs';
import type { Config } from '../shared/protocol';
import { webcamPerchStatus } from '../shared/states';
import './obs.css';
import { fetchService, isJudgingSession } from './judging/transport';

export function ObsWebcamPanel({
  config,
  serviceConnected,
  onFollowingChange,
  onSourceChange,
}: {
  config: Config;
  serviceConnected: boolean;
  onFollowingChange: (following: boolean) => void;
  onSourceChange: (source: 'manual' | 'obs') => void;
}) {
  const [status, setStatus] = useState<ObsStatus | null>(null);
  const [port, setPort] = useState('4455');
  const [password, setPassword] = useState('');
  const [sourceQuery, setSourceQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    onFollowingChange(serviceConnected && status?.phase === 'connected');
  }, [serviceConnected, status?.phase, onFollowingChange]);
  useEffect(() => {
    if (!serviceConnected || isJudgingSession()) return;
    let disposed = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    async function read() {
      try {
        const response = await fetchService('/api/obs', { cache: 'no-store' });
        if (!response.ok) throw new Error('OBS status unavailable.');
        const next = obsStatusSchema.parse(await response.json());
        if (!disposed) setStatus(next);
      } catch {
        if (!disposed) setError('Could not read OBS status. Check the local Tavi service.');
      } finally {
        if (!disposed)
          timer = setTimeout(() => {
            void read();
          }, 2000);
      }
    }
    void read();
    return () => {
      disposed = true;
      clearTimeout(timer);
    };
  }, [serviceConnected]);

  async function action(name: 'connect' | 'disconnect' | 'select', data: object = {}) {
    setBusy(true);
    setError('');
    try {
      const response = await fetchService(`/api/obs/${name}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-tavi-request': 'studio' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Could not apply OBS connection settings.');
      setStatus(obsStatusSchema.parse(await response.json()));
    } catch {
      setError(
        'Could not apply OBS settings. Check that Tavi and OBS are running on this computer.',
      );
    } finally {
      setPassword('');
      setBusy(false);
    }
  }
  const following = status?.phase === 'connected';
  const selectedSource = status?.sources.find((source) => source.id === status.selection);
  const sourceMatches = (status?.sources ?? []).filter((source) =>
    source.name.toLocaleLowerCase().includes(sourceQuery.trim().toLocaleLowerCase()),
  );
  const perch = webcamPerchStatus({ scene: config.scene, home: { x: config.x, y: config.y } });
  return (
    <section className="obs-awareness">
      {isJudgingSession() && (
        <p className="helper-note">
          OBS camera detection requires the desktop app. Use a manual webcam region here.
        </p>
      )}
      <label className="field">
        Webcam region source
        <select
          value={config.scene.webcamSource ?? 'obs'}
          disabled={!serviceConnected || busy || following}
          onChange={(event) => {
            onSourceChange(event.target.value === 'manual' ? 'manual' : 'obs');
          }}
        >
          <option value="obs" disabled={isJudgingSession()}>
            Detect in OBS
          </option>
          <option value="manual">Manual region — not verified by OBS</option>
        </select>
      </label>
      <p className="obs-perch" role="status">
        {following && status.webcam
          ? `OBS verified: ${status.scene ?? ''}`
          : config.scene.webcamSource === 'manual'
            ? 'Manual rectangle only. Its existence has not been checked in OBS.'
            : 'Webcam not detected. Perching is unavailable until OBS confirms a source.'}
      </p>
      <details className="obs-webcam" open>
        <summary>Locate webcam in OBS</summary>
        <p>
          In OBS, open Tools → WebSocket Server Settings and enable the server. Tavi reads the
          active scene on this computer.
        </p>
        <fieldset
          className="obs-controls"
          disabled={!serviceConnected || busy || isJudgingSession()}
        >
          {!following ? (
            <>
              <div className="obs-credentials">
                <label className="field">
                  OBS port
                  <input
                    type="number"
                    min="1"
                    max="65535"
                    value={port}
                    onChange={(event) => {
                      setPort(event.target.value);
                    }}
                  />
                </label>
                <label className="field">
                  WebSocket password
                  <input
                    type="password"
                    value={password}
                    autoComplete="off"
                    onChange={(event) => {
                      setPassword(event.target.value);
                    }}
                    placeholder="From OBS settings"
                  />
                </label>
              </div>
              <button
                className="secondary-button"
                type="button"
                disabled={
                  !Number.isInteger(Number(port)) || Number(port) < 1 || Number(port) > 65535
                }
                onClick={() => {
                  void action('connect', { port: Number(port), password });
                }}
              >
                {busy ? 'Searching OBS…' : 'Find webcam in OBS'}
              </button>
            </>
          ) : (
            <>
              <label className="field">
                Search OBS sources in {status.scene}
                <input
                  type="search"
                  value={sourceQuery}
                  onChange={(event) => {
                    setSourceQuery(event.target.value);
                  }}
                  placeholder="Type any part of the source name"
                />
              </label>
              <label className="field">
                Matching sources ({sourceMatches.length})
                <select
                  value={status.selection ?? ''}
                  onChange={(event) => {
                    void action('select', { source: event.target.value || null });
                  }}
                >
                  <option value="">Auto-detect one named webcam</option>
                  {selectedSource &&
                  !sourceMatches.some((source) => source.id === selectedSource.id) ? (
                    <option value={selectedSource.id}>
                      Current selection: {selectedSource.name}
                    </option>
                  ) : null}
                  {sourceMatches.map((source) => (
                    <option key={source.id} value={source.id} disabled={!source.rect}>
                      {source.name}
                      {source.rect ? '' : ' (place manually)'}
                    </option>
                  ))}
                </select>
              </label>
              <button
                className="secondary-button"
                type="button"
                onClick={() => {
                  void action('disconnect');
                }}
              >
                Disconnect OBS
              </button>
            </>
          )}
        </fieldset>
        <p role="status">
          {busy
            ? 'Searching the active OBS scene for webcam sources…'
            : (status?.message ?? 'Checking OBS connection…')}
        </p>
        {following ? (
          <>
            <p className="obs-perch">
              {status.webcam
                ? perch.reason
                : 'No confirmed webcam region. Tavi will hesitate instead of perching.'}
            </p>
            <p>
              Webcam bounds follow OBS while connected. Tavi’s browser source should fill the OBS
              canvas. Disconnect to place the region manually.
            </p>
          </>
        ) : (
          <p>
            The password is used for this connection only and is not saved. Manual scene placement
            remains available.
          </p>
        )}
        {error ? <p role="alert">{error}</p> : null}
      </details>
    </section>
  );
}
