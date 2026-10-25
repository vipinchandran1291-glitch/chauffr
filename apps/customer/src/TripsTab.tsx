import { formatRupees, type Booking } from '@chauffr/shared';
import { formatWhen, StatusBadge, useAction, useLoad, useSession } from '@chauffr/ui';

export function TripsTab() {
  const { api } = useSession();
  const { data: bookings, error, reload } = useLoad(() => api<Booking[]>('GET', '/customer/bookings'), [api], 10_000);

  if (error) return <p className="error">{error}</p>;
  if (!bookings) return <p className="muted">Loading...</p>;
  if (!bookings.length) return <p className="empty">No trips yet.</p>;

  return (
    <div className="stack">
      {bookings.map((b) => (
        <TripCard key={b.id} booking={b} onChange={reload} />
      ))}
    </div>
  );
}

function TripCard({ booking: b, onChange }: { booking: Booking; onChange(): void }) {
  const { api } = useSession();
  const action = useAction();
  const cancellable = b.status === 'requested' || b.status === 'assigned';

  const cancel = () => {
    if (!confirm('Cancel this booking?')) return;
    action.run(async () => {
      await api('POST', `/customer/bookings/${b.id}/cancel`, {});
      onChange();
    });
  };

  return (
    <div className="card">
      <div className="spread">
        <h3>{formatWhen(b.scheduledAt)}</h3>
        <StatusBadge status={b.status} />
      </div>
      <p className="small muted">
        {b.car.make} {b.car.model} - {b.car.registration} - {b.bookedHours} hrs
      </p>
      <p className="small">{b.pickupAddress}</p>

      {b.status === 'requested' && <p className="small muted">We're finding a driver for you. You'll see their details here.</p>}

      {b.driver && (b.status === 'assigned' || b.status === 'in_progress') && (
        <div className="spread">
          <div>
            <strong>{b.driver.name}</strong>
            {b.driver.phone && (
              <p className="small">
                <a href={`tel:+91${b.driver.phone}`}>Call +91 {b.driver.phone}</a>
              </p>
            )}
          </div>
          {b.status === 'assigned' && (
            <div style={{ textAlign: 'right' }}>
              <p className="small muted">Start code</p>
              <p className="otp">{b.startOtp}</p>
            </div>
          )}
        </div>
      )}
      {b.status === 'assigned' && <p className="small muted">Share the start code with your driver only when they arrive.</p>}

      {b.fare ? (
        <div className="spread">
          <span className="muted small">
            {b.fare.billedHours} hrs billed{b.fare.nightCharge ? ', incl. night charge' : ''}
          </span>
          <span className="amount">{formatRupees(b.fare.total)}</span>
        </div>
      ) : (
        b.status !== 'cancelled' && <p className="small muted">Estimate {formatRupees(b.estimatedFare)}</p>
      )}
      {b.cancelReason && <p className="small muted">{b.cancelReason}</p>}

      {action.error && <p className="error">{action.error}</p>}
      {cancellable && (
        <button className="danger" onClick={cancel} disabled={action.busy}>
          Cancel booking
        </button>
      )}
    </div>
  );
}
