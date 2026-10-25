import { useState } from 'react';
import type { User } from '@chauffr/shared';
import { errorMessage, type Api } from './api.ts';

export function ProfileForm({ api, user, onSaved, intro }: { api: Api; user: User; onSaved(u: User): void; intro?: string }) {
  const [name, setName] = useState(user.name);
  const [phone, setPhone] = useState(user.phone ?? '');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      onSaved(await api<User>('PATCH', '/auth/me', { name, phone }));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="page stack" onSubmit={submit}>
      <h2>Your details</h2>
      {intro && <p className="muted">{intro}</p>}
      <label>
        Full name
        <input required value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <label>
        Mobile number
        <input required inputMode="numeric" maxLength={10} placeholder="98XXXXXXXX" value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))} />
      </label>
      {error && <p className="error">{error}</p>}
      <button type="submit" disabled={saving}>
        {saving ? 'Saving...' : 'Save'}
      </button>
    </form>
  );
}
