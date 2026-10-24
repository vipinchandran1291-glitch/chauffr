import { useState, type FormEvent } from 'react';
import { api, errorMessage } from '@chauffr/shared';
import { Icon } from './Icon';
import { useSession } from './session';

/** Collects the name and mobile number every account needs before using the app. */
export function ProfileForm({ intro }: { intro: string }) {
  const { user, refresh } = useSession();
  const [name, setName] = useState(user?.name ?? '');
  const [phone, setPhone] = useState(user?.phone?.replace(/^\+91/, '') ?? '');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.patch('/api/me', { name, phone });
      await refresh();
    } catch (err) {
      setError(errorMessage(err));
      setSaving(false);
    }
  }

  return (
    <form className="card stack" onSubmit={submit}>
      <div className="stack-sm">
        <h2>Welcome! Let's set up your account</h2>
        <p className="muted">{intro}</p>
      </div>
      <label>
        Full name
        <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required />
      </label>
      <label>
        Mobile number
        <div className="phone-input">
          <span>+91</span>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            inputMode="numeric"
            autoComplete="tel-national"
            placeholder="98450 12345"
            required
          />
        </div>
      </label>
      <p className="alert info small">
        <Icon name="lock" size={18} />
        Your number is only shared with your driver during a trip.
      </p>
      {error && <p className="error small">{error}</p>}
      <button type="submit" className="block" disabled={saving}>{saving ? 'Saving…' : 'Continue'}</button>
    </form>
  );
}
