import { useState } from 'react';
import { formatRupees, type Booking, type DriverProfile, type DriverProfileInput } from '@chauffr/shared';
import { createApi, formatWhen, SessionGate, Shell, StatusBadge, useAction, useLoad, useSession } from '@chauffr/ui';

const api = createApi('driver');

export function App() {
  return (
    <SessionGate api={api} title="Chauffr Driver" tagline="Drive with Chauffr. Get paid for every hour.">
      <Home />
    </SessionGate>
  );
}

function Home() {
  const { api } = useSession();
  const { data: profile, reload, error } = useLoad(() => api<DriverProfile | null>('GET', '/driver/profile'), [api], 30_000);

  return (
    <Shell title="Chauffr Driver">
      {error && <p className="error">{error}</p>}
      {profile === undefined ? (
        <p className="muted">Loading...</p>
      ) : profile?.status === 'approved' ? (
        <Dashboard profile={profile} onProfile={reload} />
      ) : (
        <Onboarding profile={profile} onSaved={reload} />
      )}
    </Shell>
  );
}

function Onboarding({ profile, onSaved }: { profile: DriverProfile | null; onSaved(): void }) {
  const { api } = useSession();
  const [form, setForm] = useState<DriverProfileInput>({
    licenseNumber: profile?.licenseNumber ?? '',
    licenseExpiry: profile?.licenseExpiry ?? '',
    transmission: profile?.transmission ?? 'manual',
  });
  const action = useAction();

  if (profile?.status === 'suspended') {
    return (
      <div className="card">
        <StatusBadge status="suspended" />
        <p>Your account is suspended. Please contact Chauffr support.</p>
        {profile.adminNote && <p className="small muted">{profile.adminNote}</p>}
      </div>
    );
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    action.run(async () => {
      await api('PUT', '/driver/profile', form);
      onSaved();
    });
  };

  return (
    <div className="stack">
      {profile && (
        <div className="card">
          <StatusBadge status={profile.status} />
          {profile.status === 'pending' && (
            <p>Thanks! Our team will verify your licence and call you for a background check.</p>
          )}
          {profile.status === 'rejected' && <p>Your application was not approved. Update your details and resubmit.</p>}
          {profile.adminNote && <p className="small muted">{profile.adminNote}</p>}
        </div>
      )}
      <form className="card stack" onSubmit={submit}>
        <h3>{profile ? 'Your licence details' : 'Become a Chauffr driver'}</h3>
        <label>
          Driving licence number
          <input required placeholder="KA0120200001234" value={form.licenseNumber} onChange={(e) => setForm({ ...form, licenseNumber: e.target.value })} />
        </label>
        <label>
          Licence valid until
          <input type="date" required value={form.licenseExpiry} onChange={(e) => setForm({ ...form, licenseExpiry: e.target.value })} />
        </label>
        <label>
          Cars you can drive
          <select value={form.transmission} onChange={(e) => setForm({ ...form, transmission: e.target.value as DriverProfileInput['transmission'] })}>
            <option value="manual">Manual only</option>
            <option value="automatic">Automatic only</option>
            <option value="both">Manual and automatic</option>
          </select>
        </label>
        {action.error && <p className="error">{action.error}</p>}
        <button type="submit" disabled={action.busy}>
          {profile ? 'Update and resubmit' : 'Submit for review'}
        </button>
      </form>
    </div>
  );
}

function Dashboard({ profile, onProfile }: { profile: DriverProfile; onProfile(): void }) {
  const { api } = useSession();
  const { data: trips, reload } = useLoad(() => api<Booking[]>('GET', '/driver/bookings'), [api], 10_000);
  const toggle = useAction();

  const setOnline = (online: boolean) =>
    toggle.run(async () => {
      await api('POST', '/driver/online', { online });
      onProfile();
    });

  const active = trips?.filter((t) => t.status === 'assigned' || t.status === 'in_progress') ?? [];
  const past = trips?.filter((t) => t.status === 'completed' || t.status === 'cancelled') ?? [];
  const earning = (t: Booking) => t.fare?.driverEarning ?? 0;
  const owed = past.filter((t) => t.paymentStatus === 'paid' && !t.paidOut).reduce((s, t) => s + earning(t), 0);
  const awaiting = past.filter((t) => t.status === 'completed' && t.paymentStatus === 'unpaid').reduce((s, t) => s + earning(t), 0);

  return (
    <div className="stack">
      <div className="card toggle">
        <div>
          <strong>{profile.isOnline ? 'You are online' : 'You are offline'}</strong>
          <p className="small muted">{profile.isOnline ? 'Ops can assign you trips.' : 'Go online to receive trips.'}</p>
        </div>
        <button className={profile.isOnline ? 'secondary' : ''} disabled={toggle.busy} onClick={() => setOnline(!profile.isOnline)}>
          {profile.isOnline ? 'Go offline' : 'Go online'}
        </button>
      </div>
      {toggle.error && <p className="error">{toggle.error}</p>}

      <h2>Upcoming trips</h2>
      {!trips && <p className="muted">Loading...</p>}
      {trips && !active.length && <p className="empty">No trips assigned right now.</p>}
      {active.map((t) => (
        <ActiveTrip key={t.id} trip={t} onChange={reload} />
      ))}

      {past.length > 0 && (
        <>
          <div className="card">
            <div className="spread">
              <span className="muted">Chauffr owes you</span>
              <span className="amount">{formatRupees(owed)}</span>
            </div>
            {awaiting > 0 && <p className="small muted">+ {formatRupees(awaiting)} once customers pay for their trips</p>}
            <p className="small muted">Payouts are sent weekly to your bank or UPI.</p>
          </div>
          <h2>Recent trips</h2>
          {past.map((t) => (
            <div key={t.id} className="card spread">
              <div>
                <strong>{formatWhen(t.scheduledAt)}</strong>
                <p className="small muted">
                  {t.car.make} {t.car.model} - {t.customer.name}
                </p>
              </div>
              {t.fare ? (
                <div style={{ textAlign: 'right' }}>
                  <strong>{formatRupees(t.fare.driverEarning)}</strong>
                  <p className="small muted">
                    {t.paidOut ? 'Paid out' : t.paymentStatus === 'paid' ? 'Customer paid' : 'Awaiting payment'}
                  </p>
                </div>
              ) : (
                <StatusBadge status={t.status} />
              )}
            </div>
          ))}
        </>
      )}
    </div>
  );
}

function ActiveTrip({ trip: t, onChange }: { trip: Booking; onChange(): void }) {
  const { api } = useSession();
  const [otp, setOtp] = useState('');
  const action = useAction();

  const start = (e: React.FormEvent) => {
    e.preventDefault();
    action.run(async () => {
      await api('POST', `/driver/bookings/${t.id}/start`, { otp });
      onChange();
    });
  };

  const end = () => {
    if (!confirm('End this trip? The customer will be billed for the time so far.')) return;
    action.run(async () => {
      await api('POST', `/driver/bookings/${t.id}/end`);
      onChange();
    });
  };

  return (
    <div className="card">
      <div className="spread">
        <h3>{formatWhen(t.scheduledAt)}</h3>
        <StatusBadge status={t.status} />
      </div>
      <p>{t.pickupAddress}</p>
      <p className="small muted">
        {t.car.make} {t.car.model} ({t.car.transmission}) - {t.car.registration} - booked {t.bookedHours} hrs
      </p>
      <p className="small">
        {t.customer.name}
        {t.customer.phone && (
          <>
            {' '}
            - <a href={`tel:+91${t.customer.phone}`}>Call +91 {t.customer.phone}</a>
          </>
        )}
      </p>

      {t.status === 'assigned' && (
        <form className="row" onSubmit={start}>
          <input
            required
            inputMode="numeric"
            maxLength={4}
            placeholder="Start code from customer"
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
            style={{ flex: 1 }}
          />
          <button type="submit" disabled={action.busy || otp.length !== 4}>
            Start trip
          </button>
        </form>
      )}
      {t.status === 'in_progress' && (
        <>
          <p className="small muted">Started {formatWhen(t.startedAt!)}</p>
          <button onClick={end} disabled={action.busy}>
            End trip
          </button>
        </>
      )}
      {action.error && <p className="error">{action.error}</p>}
    </div>
  );
}
