import { useEffect, useState, type FormEvent } from 'react';
import { api, CAR_TYPE_LABELS, CAR_TYPES, errorMessage, type CarType, type DriverProfile, type DriverStatus } from '@chauffr/shared';
import { Icon, useSession } from '@chauffr/ui';

const STEPS = ['Sign up', 'Your details', 'Verification', 'Start driving'];

function stepClass(index: number, status: DriverStatus): string {
  const current = { incomplete: 1, pending: 2, rejected: 2, approved: 4, suspended: 3 }[status];
  if (index < current) return 'done';
  if (index === current) return status === 'rejected' || status === 'suspended' ? 'failed' : 'current';
  return '';
}

export function DriverHome() {
  const { user } = useSession();
  const [profile, setProfile] = useState<DriverProfile | null>(null);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get<{ profile: DriverProfile }>('/api/driver/profile').then(
      (r) => setProfile(r.profile),
      (err) => setError(errorMessage(err)),
    );
  }, []);

  if (error) return <p className="alert danger">{error}</p>;
  if (!profile) return <p className="muted">Loading…</p>;

  const canEdit = profile.status === 'pending' || profile.status === 'rejected';
  const showForm = profile.status === 'incomplete' || editing;

  return (
    <>
      <div className="greeting">
        <h1>Hi {user?.name.split(' ')[0] || 'there'}</h1>
        <p>{profile.status === 'approved' ? "You're a verified Chauffr driver." : "Let's get you on the road."}</p>
      </div>

      <section className="card stack">
        <ol className="stepper">
          {STEPS.map((s, i) => (
            <li key={s} className={stepClass(i, profile.status)}>{s}</li>
          ))}
        </ol>
        <StatusMessage profile={profile} />
      </section>

      {showForm ? (
        <DetailsForm
          profile={profile}
          onSaved={(p) => {
            setProfile(p);
            setEditing(false);
          }}
          onCancel={profile.status === 'incomplete' ? undefined : () => setEditing(false)}
        />
      ) : (
        <section className="card stack">
          <div className="card-header">
            <h2>Your details</h2>
            {canEdit && <button type="button" className="secondary sm" onClick={() => setEditing(true)}>Edit</button>}
          </div>
          <dl className="details">
            <dt>Licence</dt>
            <dd>{profile.licenceNumber}</dd>
            <dt>Valid till</dt>
            <dd>{profile.licenceExpiry}</dd>
            <dt>Transmission</dt>
            <dd>{[profile.canManual && 'Manual', profile.canAutomatic && 'Automatic'].filter(Boolean).join(' & ')}</dd>
            <dt>Car types</dt>
            <dd>{profile.carTypes.map((t) => CAR_TYPE_LABELS[t]).join(', ')}</dd>
          </dl>
        </section>
      )}
    </>
  );
}

function StatusMessage({ profile }: { profile: DriverProfile }) {
  switch (profile.status) {
    case 'incomplete':
      return <p className="alert info"><Icon name="idCard" />Add your licence details below. It takes about a minute.</p>;
    case 'pending':
      return (
        <p className="alert warning">
          <Icon name="clock" />
          <span><strong>Under review.</strong> Our team will call you to verify your licence and ID, usually within 2 working days.</span>
        </p>
      );
    case 'rejected':
      return (
        <p className="alert danger">
          <Icon name="alert" />
          <span><strong>Not approved:</strong> {profile.rejectionReason}. Update your details and resubmit.</span>
        </p>
      );
    case 'approved':
      return (
        <p className="alert success">
          <Icon name="shieldCheck" />
          <span><strong>You're verified.</strong> Going online and accepting trips arrives in the next update.</span>
        </p>
      );
    case 'suspended':
      return (
        <p className="alert danger">
          <Icon name="alert" />
          <span><strong>Account suspended:</strong> {profile.rejectionReason}. Contact support.</span>
        </p>
      );
  }
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
      <div className="stack-sm">
        <h2>Driver details</h2>
        <p className="muted small">We use these to match you with cars you can drive.</p>
      </div>
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
        <div className="choice-group">
          <label className="choice">
            <input type="checkbox" checked={canManual} onChange={(e) => setCanManual(e.target.checked)} />
            {canManual && <Icon name="check" size={16} />} Manual
          </label>
          <label className="choice">
            <input type="checkbox" checked={canAutomatic} onChange={(e) => setCanAutomatic(e.target.checked)} />
            {canAutomatic && <Icon name="check" size={16} />} Automatic
          </label>
        </div>
      </fieldset>
      <fieldset>
        <legend>Car types I'm comfortable with</legend>
        <div className="choice-group">
          {CAR_TYPES.map((t) => (
            <label key={t} className="choice">
              <input type="checkbox" checked={carTypes.includes(t)} onChange={() => toggleCarType(t)} />
              {carTypes.includes(t) && <Icon name="check" size={16} />} {CAR_TYPE_LABELS[t]}
            </label>
          ))}
        </div>
      </fieldset>
      {error && <p className="error small">{error}</p>}
      <div className="row">
        <button type="submit" disabled={saving}>{saving ? 'Submitting…' : 'Submit for verification'}</button>
        {onCancel && <button type="button" className="secondary" onClick={onCancel}>Cancel</button>}
      </div>
    </form>
  );
}
