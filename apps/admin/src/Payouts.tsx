import { formatRupees, type DriverOwed, type Payout } from '@chauffr/shared';
import { formatWhen, useAction, useLoad, useSession } from '@chauffr/ui';

export function Payouts() {
  const { api } = useSession();
  const { data, error, reload } = useLoad(() => api<{ owed: DriverOwed[]; payouts: Payout[] }>('GET', '/admin/payouts'), [api]);
  const action = useAction();

  const markPaid = (d: DriverOwed) => {
    const reference = prompt(
      `Pay ${d.name} ${formatRupees(d.owed)} by UPI or bank transfer first.\n\nThen enter the transaction reference (UTR / UPI ref):`,
    );
    if (!reference) return;
    action.run(async () => {
      await api('POST', '/admin/payouts', { driverId: d.driverId, reference });
      reload();
    });
  };

  if (error) return <p className="error">{error}</p>;
  if (!data) return <p className="muted">Loading...</p>;

  const total = data.owed.reduce((s, d) => s + d.owed, 0);

  return (
    <div className="stack">
      <div className="spread">
        <h2>Owed to drivers</h2>
        <span className="amount">{formatRupees(total)}</span>
      </div>
      <p className="small muted">Driver share of trips customers have paid for, not yet paid out.</p>
      {!data.owed.length && <p className="empty">Nothing owed right now.</p>}
      {data.owed.map((d) => (
        <div key={d.driverId} className="card spread">
          <div>
            <strong>{d.name}</strong>
            <p className="small muted">
              {d.trips} trip{d.trips > 1 ? 's' : ''}
              {d.phone && ` - +91 ${d.phone}`}
            </p>
          </div>
          <div className="row">
            <strong>{formatRupees(d.owed)}</strong>
            <button onClick={() => markPaid(d)} disabled={action.busy}>
              Mark as paid
            </button>
          </div>
        </div>
      ))}
      {action.error && <p className="error">{action.error}</p>}

      {data.payouts.length > 0 && (
        <>
          <h2>Recent payouts</h2>
          {data.payouts.map((p) => (
            <div key={p.id} className="card spread">
              <div>
                <strong>{p.driverName}</strong>
                <p className="small muted">
                  {formatWhen(p.createdAt)} - {p.bookingCount} trip{p.bookingCount > 1 ? 's' : ''} - ref {p.reference}
                </p>
              </div>
              <strong>{formatRupees(p.amount)}</strong>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
