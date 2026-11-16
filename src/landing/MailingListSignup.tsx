import { useRef, useState } from 'react';
import type { SyntheticEvent } from 'react';
import { joinMailingList, mailingListConfig } from './mailingList';
import './mailing-list.css';

export function MailingListSignup() {
  const config = mailingListConfig();
  const submitting = useRef(false);
  const [status, setStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  async function subscribe(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!config || submitting.current) return;
    const data = new FormData(event.currentTarget);
    if (data.get('website')) return;
    submitting.current = true;
    setStatus('saving');
    setMessage('Saving your signup…');
    try {
      const email = data.get('email');
      await joinMailingList(
        config,
        typeof email === 'string' ? email : '',
        data.get('consent') === 'on',
      );
      setStatus('success');
      setMessage('Signup saved. We’ll email you a confirmation before sending updates.');
    } catch {
      setStatus('error');
      setMessage('Signup could not be saved. Check your connection and try again.');
    } finally {
      submitting.current = false;
    }
  }

  return (
    <form
      className="mailing-list-signup"
      method="post"
      onSubmit={(event) => void subscribe(event)}
      aria-labelledby="mailing-list-title"
    >
      <h3 id="mailing-list-title">Get release updates</h3>
      <label className="mailing-list-email-label" htmlFor="mailing-list-email">
        Email address
      </label>
      <div className="mailing-list-fields">
        <input
          id="mailing-list-email"
          name="email"
          type="email"
          autoComplete="email"
          maxLength={254}
          required
          disabled={status === 'saving' || status === 'success'}
          placeholder="you@example.com"
        />
        <button type="submit" disabled={!config || status === 'saving' || status === 'success'}>
          {status === 'saving' ? 'Joining…' : status === 'success' ? 'Joined' : 'Join the list'}
        </button>
      </div>
      <label className="mailing-list-consent">
        <input
          name="consent"
          type="checkbox"
          required
          disabled={status === 'saving' || status === 'success'}
        />
        <span>Email me about Tavi releases and updates.</span>
      </label>
      <label className="mailing-list-trap" aria-hidden="true">
        Website
        <input name="website" tabIndex={-1} autoComplete="off" />
      </label>
      <p className="mailing-list-status" role="status" data-error={status === 'error'}>
        {!config ? 'Signups are temporarily unavailable.' : message}
      </p>
    </form>
  );
}
