import { useEffect, useState, type FormEvent } from 'react';
import { api, CAR_TYPE_LABELS, CAR_TYPES, errorMessage, type CarType, type DriverProfile } from '@chauffr/shared';

export function DriverHome() {
  const [profile, setProfile] = useState<DriverProfile | null>(null);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get<{ profile: DriverProfile }>('/api/driver/profile').then(
      (r) => setProfile(r.profile),
      (err) => setError(errorMessage(err)),
    );
  }, []);

  if (error) return <p className="error">{error}</p>;
  if (!profile) return <p className="muted">Loading…</p>;

  const canEdit = profile.status === 'incomplete' || profile.status === 'pending' || profile.status === 'rejected';
  if (profile.status === 'incomplete' || editing) {
    return (
      <DetailsForm
        profile={profile}
        onSaved={(p) => {
          setProfile(p);
          setEditing(false);
        }}
        onCancel={profile.status === 'incomplete' ? undefined : () => setEditing(false)}
      />
    );
  }

  return (
    <>
      <section className="card stack">
        <div className="spread">
          <h2>Application</h2>
          <span className={`badge ${profile.status}`}>{profile.status}</span>
        </div>
        {profile.status === 'pending' && <p className="muted">We're reviewing your details. We'll call you to verify documents.</p>}
        {profile.status === 'rejected' && <p className="error">Not approved: {profile.rejectionReason}</p>}
        {profile.status === 'approved' && <p className="success">You're approved. Going online and accepting trips arrives in the next update.</p>}
        {profile.status === 'suspended' && <p className="error">Your account is suspended: {profile.rejectionReason}. Contact support.</p>}
        {canEdit && <button type="button" className="secondary" onClick={() => setEditing(true)}>Edit details</button>}
      </section>
      <section className="card stack">
        <h2>Your details</h2>
        <p className="muted">Licence: {profile.licenceNumber} (valid till {profile.licenceExpiry})</p>
        <p className="muted">
          Drives: {[profile.canManual && 'manual', profile.canAutomatic && 'automatic'].filter(Boolean).join(' & ')} ·{' '}
          {profile.carTypes.map((t) => CAR_TYPE_LABELS[t]).join(', ')}
        </p>
      </section>
    </>
  );
}

interface FormProps {
  profile: DriverProfile;
  onSaved(profile: DriverProfile): void;
  onCancel?: () => void;
}

function DetailsForm({ profile, onSaved, onCancel }: FormProps) {
  const [licenceNumber, setLicenceNumber] = useState(profile.licenceNumber ?? '');
  const [licenceExpiry, setLicenceExpiry] = useState(profile.licenceExpiry ?? '');
  const [canManual, setCanManual] = useState(profile.canManual);
  const [canAutomatic, setCanAutomatic] = useState(profile.canAutomatic);
  const [carTypes, setCarTypes] = useState<CarType[]>(profile.carTypes);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const toggleCarType = (t: CarType) =>
    setCarTypes((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const r = await api.put<{ profile: DriverProfile }>('/api/driver/profile', {
        licenceNumber,
        licenceExpiry,
        canManual,
        canAutomatic,
        carTypes,
      });
      onSaved(r.profile);
    } catch (err) {
      setError(errorMessage(err));
      setSaving(false);
    }
  }

  return (
    <form className="card stack" onSubmit={submit}>
      <h2>Driver details</h2>
      <p className="muted">We use these to match you with cars you can drive. Document upload comes next.</p>
      <label>
        Driving licence number
        <input value={licenceNumber} onChange={(e) => setLicenceNumber(e.target.value)} placeholder="KA01 20190001234" required />
      </label>
      <label>
        Licence valid till
        <input type="date" value={licenceExpiry} onChange={(e) => setLicenceExpiry(e.target.value)} required />
      </label>
      <fieldset>
        <legend>I can drive</legend>
        <label className="check"><input type="checkbox" checked={canManual} onChange={(e) => setCanManual(e.target.checked)} /> Manual</label>
        <label className="check"><input type="checkbox" checked={canAutomatic} onChange={(e) => setCanAutomatic(e.target.checked)} /> Automatic</label>
      </fieldset>
      <fieldset>
        <legend>Car types</legend>
        {CAR_TYPES.map((t) => (
          <label key={t} className="check">
            <input type="checkbox" checked={carTypes.includes(t)} onChange={() => toggleCarType(t)} /> {CAR_TYPE_LABELS[t]}
          </label>
        ))}
      </fieldset>
      {error && <p className="error">{error}</p>}
      <div className="row">
        <button type="submit" disabled={saving}>{saving ? 'Submitting…' : 'Submit for review'}</button>
        {onCancel && <button type="button" className="secondary" onClick={onCancel}>Cancel</button>}
      </div>
    </form>
  );
}
