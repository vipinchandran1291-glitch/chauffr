import { useCallback, useEffect, useState } from 'react';
import { api, CAR_TYPE_LABELS, DRIVER_STATUSES, errorMessage, type AdminDriver, type DriverStatus } from '@chauffr/shared';

type Filter = DriverStatus | 'all';
const FILTERS: Filter[] = ['pending', ...DRIVER_STATUSES.filter((s) => s !== 'pending'), 'all'];

export function Drivers() {
  const [filter, setFilter] = useState<Filter>('pending');
  const [drivers, setDrivers] = useState<AdminDriver[] | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const query = filter === 'all' ? '' : `?status=${filter}`;
      setDrivers((await api.get<{ drivers: AdminDriver[] }>(`/api/admin/drivers${query}`)).drivers);
    } catch (err) {
      setError(errorMessage(err));
    }
  }, [filter]);

  useEffect(() => {
    setDrivers(null);
    void load();
  }, [load]);

  async function setStatus(driver: AdminDriver, status: 'approved' | 'rejected' | 'suspended') {
    let reason: string | undefined;
    if (status !== 'approved') {
      reason = prompt(`Reason for ${status === 'rejected' ? 'rejecting' : 'suspending'} ${driver.name}? The driver will see this.`)?.trim();
      if (!reason) return;
    } else if (!confirm(`Approve ${driver.name}? Make sure you've checked their licence and ID.`)) {
      return;
    }
    try {
      await api.post(`/api/admin/drivers/${driver.userId}/status`, { status, reason });
      await load();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <section className="card stack">
      <div className="spread">
        <h2>Drivers</h2>
        <div className="tabs">
          {FILTERS.map((f) => (
            <button key={f} type="button" className={`small ${f === filter ? 'active' : ''}`} onClick={() => setFilter(f)}>{f}</button>
          ))}
        </div>
      </div>
      {error && <p className="error">{error}</p>}
      {drivers === null ? (
        <p className="muted">Loading…</p>
      ) : drivers.length === 0 ? (
        <p className="muted">No drivers here.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Driver</th>
                <th>Licence</th>
                <th>Can drive</th>
                <th>Status</th>
                <th>Signed up</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {drivers.map((d) => (
                <tr key={d.userId}>
                  <td>
                    <strong>{d.name || '—'}</strong>
                    <div className="muted">{d.email}</div>
                    <div className="muted">{d.phone ?? 'No phone'}</div>
                  </td>
                  <td>
                    {d.licenceNumber ?? '—'}
                    {d.licenceExpiry && <div className="muted">till {d.licenceExpiry}</div>}
                  </td>
                  <td>
                    {[d.canManual && 'Manual', d.canAutomatic && 'Automatic'].filter(Boolean).join(', ') || '—'}
                    <div className="muted">{d.carTypes.map((t) => CAR_TYPE_LABELS[t]).join(', ')}</div>
                  </td>
                  <td>
                    <span className={`badge ${d.status}`}>{d.status}</span>
                    {d.rejectionReason && <div className="muted">{d.rejectionReason}</div>}
                  </td>
                  <td className="muted">{new Date(d.createdAt).toLocaleDateString('en-IN')}</td>
                  <td>
                    <div className="row">
                      {(d.status === 'pending' || d.status === 'suspended' || d.status === 'rejected') && d.licenceNumber && (
                        <button type="button" className="small" onClick={() => void setStatus(d, 'approved')}>Approve</button>
                      )}
                      {d.status === 'pending' && (
                        <button type="button" className="danger small" onClick={() => void setStatus(d, 'rejected')}>Reject</button>
                      )}
                      {d.status === 'approved' && (
                        <button type="button" className="danger small" onClick={() => void setStatus(d, 'suspended')}>Suspend</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
