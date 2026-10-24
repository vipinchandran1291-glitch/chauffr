import { useCallback, useEffect, useState } from 'react';
import { api, CAR_TYPE_LABELS, DRIVER_STATUSES, errorMessage, type AdminDriver, type DriverStatus } from '@chauffr/shared';
import { Icon } from '@chauffr/ui';

type Filter = DriverStatus | 'all';
const FILTERS: Filter[] = ['pending', ...DRIVER_STATUSES.filter((s) => s !== 'pending'), 'all'];

export function Drivers() {
  const [filter, setFilter] = useState<Filter>('pending');
  const [drivers, setDrivers] = useState<AdminDriver[] | null>(null);
  const [error, setError] = useState('');

  // The driver list is small at this stage, so load everyone once and filter in the browser.
  const load = useCallback(async () => {
    setError('');
    try {
      setDrivers((await api.get<{ drivers: AdminDriver[] }>('/api/admin/drivers')).drivers);
    } catch (err) {
      setError(errorMessage(err));
    }
  }, []);

  useEffect(() => {
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

  const count = (f: Filter) => (drivers ?? []).filter((d) => f === 'all' || d.status === f).length;
  const shown = (drivers ?? []).filter((d) => filter === 'all' || d.status === filter);

  return (
    <>
      <div className="stats">
        <div className={`card stat ${count('pending') > 0 ? 'highlight' : ''}`}>
          <span className="label">Waiting for review</span>
          <span className="value">{drivers ? count('pending') : '—'}</span>
        </div>
        <div className="card stat">
          <span className="label">Approved drivers</span>
          <span className="value">{drivers ? count('approved') : '—'}</span>
        </div>
        <div className="card stat">
          <span className="label">Signed up, no details yet</span>
          <span className="value">{drivers ? count('incomplete') : '—'}</span>
        </div>
        <div className="card stat">
          <span className="label">All drivers</span>
          <span className="value">{drivers ? count('all') : '—'}</span>
        </div>
      </div>

      <section className="card stack">
        <div className="card-header">
          <h2>Drivers</h2>
          <div className="tabs">
            {FILTERS.map((f) => (
              <button key={f} type="button" className={f === filter ? 'active' : ''} onClick={() => setFilter(f)}>
                {f} <span className="count">{drivers ? count(f) : ''}</span>
              </button>
            ))}
          </div>
        </div>
        {error && <p className="alert danger small">{error}</p>}
        {drivers === null ? (
          <p className="muted">Loading…</p>
        ) : shown.length === 0 ? (
          <div className="empty">
            <Icon name="users" size={28} />
            No {filter === 'all' ? '' : filter} drivers.
          </div>
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
                {shown.map((d) => (
                  <tr key={d.userId}>
                    <td>
                      <strong>{d.name || '—'}</strong>
                      <div className="muted small">{d.email}</div>
                      <div className="muted small">{d.phone ?? 'No phone'}</div>
                    </td>
                    <td>
                      {d.licenceNumber ?? '—'}
                      {d.licenceExpiry && <div className="muted small">till {d.licenceExpiry}</div>}
                    </td>
                    <td>
                      {[d.canManual && 'Manual', d.canAutomatic && 'Automatic'].filter(Boolean).join(', ') || '—'}
                      <div className="muted small">{d.carTypes.map((t) => CAR_TYPE_LABELS[t]).join(', ')}</div>
                    </td>
                    <td>
                      <span className={`badge ${d.status}`}>{d.status}</span>
                      {d.rejectionReason && <div className="muted small">{d.rejectionReason}</div>}
                    </td>
                    <td className="muted">{new Date(d.createdAt).toLocaleDateString('en-IN')}</td>
                    <td>
                      <div className="row" style={{ justifyContent: 'flex-end' }}>
                        {(d.status === 'pending' || d.status === 'suspended' || d.status === 'rejected') && d.licenceNumber && (
                          <button type="button" className="success sm" onClick={() => void setStatus(d, 'approved')}>
                            <Icon name="check" size={16} /> Approve
                          </button>
                        )}
                        {d.status === 'pending' && (
                          <button type="button" className="danger sm" onClick={() => void setStatus(d, 'rejected')}>Reject</button>
                        )}
                        {d.status === 'approved' && (
                          <button type="button" className="danger sm" onClick={() => void setStatus(d, 'suspended')}>Suspend</button>
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
    </>
  );
}
