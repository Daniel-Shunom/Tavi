import { useEffect, useState } from 'react';
import type { Command, Config } from '../shared/protocol';
import {
  supportPreviewSchema,
  supportSettingsSchema,
  supportTiers,
  type SupportTier,
} from '../shared/support';

/** Honest local event previews until a trusted donation/subscription adapter is connected. */
export function EventReactionsPanel({
  config,
  connected,
  send,
}: {
  config: Config;
  connected: boolean;
  send: (command: Command) => void;
}) {
  const saved = config.supportReactions;
  const [enabled, setEnabled] = useState(saved.enabled);
  const [currency, setCurrency] = useState(saved.currency);
  const [medium, setMedium] = useState(String(saved.mediumMin));
  const [big, setBig] = useState(String(saved.bigMin));
  const [kind, setKind] = useState<'donation' | 'subscription'>('donation');
  const [amount, setAmount] = useState('5');
  const [tier, setTier] = useState<SupportTier>('small');
  const [notice, setNotice] = useState('');
  useEffect(() => {
    setEnabled(saved.enabled);
    setCurrency(saved.currency);
    setMedium(String(saved.mediumMin));
    setBig(String(saved.bigMin));
  }, [saved.enabled, saved.currency, saved.mediumMin, saved.bigMin]);
  const settings = supportSettingsSchema.safeParse({
    enabled,
    currency,
    mediumMin: Number(medium),
    bigMin: Number(big),
  });
  const preview = supportPreviewSchema.safeParse(
    kind === 'donation'
      ? { kind, amount: Number(amount), currency: saved.currency }
      : { kind, tier },
  );
  return (
    <details className="support-reactions">
      <summary>Donation and subscription reactions</summary>
      <p className="helper-note">
        Simulated previews. Live donations and subscriptions are not connected. Reactions look
        toward your chat region and respect quiet mode, tuck away, and streamer priority.
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!settings.success) return;
          send({ type: 'configure', patch: { supportReactions: settings.data } });
          setNotice('Reaction settings sent.');
        }}
      >
        <fieldset disabled={!connected} className="support-controls">
          <label className="checkbox-field">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(event) => {
                setEnabled(event.target.checked);
              }}
            />
            Support reactions enabled
          </label>
          <div className="support-amounts">
            <label className="field">
              Currency
              <input
                aria-label="Donation currency"
                value={currency}
                maxLength={3}
                pattern="[A-Z]{3}"
                onChange={(event) => {
                  setCurrency(event.target.value.toUpperCase());
                }}
              />
            </label>
            <label className="field">
              Medium from
              <input
                type="number"
                min="0.01"
                step="any"
                value={medium}
                onChange={(event) => {
                  setMedium(event.target.value);
                }}
              />
            </label>
            <label className="field">
              Big from
              <input
                type="number"
                min="0.01"
                step="any"
                value={big}
                onChange={(event) => {
                  setBig(event.target.value);
                }}
              />
            </label>
          </div>
          <p className="helper-note">
            Amounts use major currency units, such as dollars rather than cents. Small reactions
            cover positive donations below the medium amount. Other currencies are skipped; Tavi
            does not guess exchange rates.
          </p>
          {!settings.success ? (
            <p className="helper-note" role="status">
              Use a three-letter currency, positive amounts, and a big amount above medium.
            </p>
          ) : null}
          <button className="secondary-button" disabled={!settings.success}>
            Save reaction tiers
          </button>
        </fieldset>
      </form>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!preview.success) return;
          send({ type: 'preview-support-event', event: preview.data });
          setNotice('Simulated event sent. See the reaction status above.');
        }}
      >
        <fieldset disabled={!connected || !saved.enabled} className="support-controls">
          <div className="support-amounts">
            <label className="field">
              Simulated event
              <select
                value={kind}
                onChange={(event) => {
                  setKind(event.target.value === 'subscription' ? 'subscription' : 'donation');
                }}
              >
                <option value="donation">Donation</option>
                <option value="subscription">Subscription</option>
              </select>
            </label>
            {kind === 'donation' ? (
              <label className="field">
                Test amount ({saved.currency})
                <input
                  type="number"
                  min="0.01"
                  step="any"
                  value={amount}
                  onChange={(event) => {
                    setAmount(event.target.value);
                  }}
                />
              </label>
            ) : (
              <label className="field">
                Reaction size
                <select
                  value={tier}
                  onChange={(event) => {
                    setTier(supportTiers.find((value) => value === event.target.value) ?? 'small');
                  }}
                >
                  {supportTiers.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
          <button className="secondary-button" disabled={!preview.success}>
            Preview {kind}
          </button>
          <p className="helper-note">Previews share the eight-second event cooldown.</p>
        </fieldset>
      </form>
      {notice ? <p role="status">{notice}</p> : null}
    </details>
  );
}
