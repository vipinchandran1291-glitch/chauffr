import { useState } from 'react';
import type { AdminDriver, DriverStatus } from '@chauffr/shared';
import { StatusBadge, useAction, useLoad, useSession } from '@chauffr/ui';

const FILTERS: { id: DriverStatus | ''; label: string }[] = [
  { id: 'pending', label: 'Pending review' },
  { id: 'approved', label: 'Approved' },
  { id: 'rejected', label: 'Rejected' },
  { id: 'suspended', label: 'Suspended' },
  { id: '', label: 'All' },
];

export function Drivers() {
  const { api } = useSession();
  const [status, setStatus] = useState<DriverStatus | ''>('pending');
  const { data: drivers, error, reload } = useLoad(
    () => api<AdminDriver[]>('GET', `/admin/drivers${status ? `?status=${status}` : ''}`),
    [api, status],
  );

  return (
    <div className="stack">
      <div className="row">
        {FILTERS.map((f) => (
          <button key={f.id} className={f.id === status ? '' : 'secondary'} onClick={() => setStatus(f.id)}>
            {f.label}
          </button>
        ))}
      </div>
      {error && <p className="error">{error}</p>}
      {drivers && !drivers.length && <p className="empty">No drivers.</p>}
      {drivers?.map((d) => (
        <DriverCard key={d.user.id} driver={d} onChange={reload} />
      ))}
    </div>
  );
}

function DriverCard({ driver: { user, profile }, onChange }: { driver: AdminDriver; onChange(): void }) {
  const { api } = useSession();
  const action = useAction();

  const setStatus = (status: DriverStatus) => {
    const note = status === 'approved' ? '' : prompt(`Note for the driver (${status})`) ?? undefined;
    if (note === undefined) return;
    action.run(async () => {
      await api('POST', `/admin/drivers/${user.id}/status`, { status, note: note || undefined });
      onChange();
    });
  };

  return (
    <div className="card">
      <div className="spread">
        <h3>{user.name}</h3>
        {profile ? <StatusBadge status={profile.status} /> : <span className="badge">No profile yet</span>}
      </div>
      <p className="small muted">
        {user.email}
        {user.phone && ` - +91 ${user.phone}`}
      </p>
      {profile && (
        <>
          <p className="small">
            Licence {profile.licenseNumber}, valid until {profile.licenseExpiry} - drives {profile.transmission}
            {profile.status === 'approved' && ` - ${profile.isOnline ? 'online' : 'offline'}`}
          </p>
          {profile.adminNote && <p className="small muted">Note: {profile.adminNote}</p>}
          <div className="row">
            {profile.status !== 'approved' && (
              <button onClick={() => setStatus('approved')} disabled={action.busy}>
                Approve
              </button>
            )}
            {profile.status === 'pending' && (
              <button className="danger" onClick={() => setStatus('rejected')} disabled={action.busy}>
                Reject
              </button>
            )}
            {profile.status === 'approved' && (
              <button className="danger" onClick={() => setStatus('suspended')} disabled={action.busy}>
                Suspend
              </button>
            )}
          </div>
        </>
      )}
      {action.error && <p className="error">{action.error}</p>}
    </div>
  );
}
