import { useState } from 'react';
import { formatRupees, type AdminDriver, type Booking, type BookingStatus } from '@chauffr/shared';
import { formatWhen, StatusBadge, useAction, useLoad, useSession } from '@chauffr/ui';

type EligibleDriver = AdminDriver & { busy: boolean };

const FILTERS: { id: BookingStatus | ''; label: string }[] = [
  { id: 'requested', label: 'Needs driver' },
  { id: 'assigned', label: 'Assigned' },
  { id: 'in_progress', label: 'On trip' },
  { id: 'completed', label: 'Completed' },
  { id: 'cancelled', label: 'Cancelled' },
  { id: '', label: 'All' },
];

export function Bookings() {
  const { api } = useSession();
  const [status, setStatus] = useState<BookingStatus | ''>('requested');
  const { data: bookings, error, reload } = useLoad(
    () => api<Booking[]>('GET', `/admin/bookings${status ? `?status=${status}` : ''}`),
    [api, status],
    10_000,
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
      {bookings && !bookings.length && <p className="empty">No bookings.</p>}
      {bookings?.map((b) => (
        <BookingCard key={b.id} booking={b} onChange={reload} />
      ))}
    </div>
  );
}

function BookingCard({ booking: b, onChange }: { booking: Booking; onChange(): void }) {
  const { api } = useSession();
  const [assigning, setAssigning] = useState(false);
  const action = useAction();
  const open = b.status === 'requested' || b.status === 'assigned';

  const cancel = () => {
    const reason = prompt('Reason for cancelling (shown to the customer)');
    if (!reason) return;
    action.run(async () => {
      await api('POST', `/admin/bookings/${b.id}/cancel`, { reason });
      onChange();
    });
  };

  return (
    <div className="card">
      <div className="spread">
        <h3>
          #{b.id} - {formatWhen(b.scheduledAt)}
        </h3>
        <StatusBadge status={b.status} />
      </div>
      <p>{b.pickupAddress}</p>
      <p className="small muted">
        {b.customer.name} (+91 {b.customer.phone}) - {b.car.make} {b.car.model}, {b.car.transmission} - {b.car.registration} -{' '}
        {b.bookedHours} hrs
      </p>
      <p className="small">
        Driver: {b.driver ? `${b.driver.name} (+91 ${b.driver.phone})` : <span className="muted">not assigned</span>}
      </p>
      <p className="small muted">
        {b.fare
          ? `Fare ${formatRupees(b.fare.total)} - driver ${formatRupees(b.fare.driverEarning)} - platform ${formatRupees(b.fare.platformFee)}`
          : `Estimate ${formatRupees(b.estimatedFare)}`}
      </p>
      {b.cancelReason && <p className="small muted">Cancelled: {b.cancelReason}</p>}

      {open && !assigning && (
        <div className="row">
          <button onClick={() => setAssigning(true)}>{b.driver ? 'Reassign' : 'Assign driver'}</button>
          <button className="danger" onClick={cancel} disabled={action.busy}>
            Cancel
          </button>
        </div>
      )}
      {assigning && (
        <AssignDriver
          booking={b}
          onDone={() => {
            setAssigning(false);
            onChange();
          }}
        />
      )}
      {action.error && <p className="error">{action.error}</p>}
    </div>
  );
}

function AssignDriver({ booking, onDone }: { booking: Booking; onDone(): void }) {
  const { api } = useSession();
  const { data: drivers } = useLoad(() => api<EligibleDriver[]>('GET', `/admin/bookings/${booking.id}/eligible-drivers`), [api, booking.id]);
  const [driverId, setDriverId] = useState<number | ''>('');
  const action = useAction();

  const assign = () =>
    action.run(async () => {
      await api('POST', `/admin/bookings/${booking.id}/assign`, { driverId });
      onDone();
    });

  if (!drivers) return <p className="muted small">Loading drivers...</p>;
  if (!drivers.length) return <p className="error small">No approved drivers can drive a {booking.car.transmission} car.</p>;

  return (
    <div className="stack">
      <select value={driverId} onChange={(e) => setDriverId(Number(e.target.value))}>
        <option value="">Choose a driver</option>
        {drivers.map((d) => (
          <option key={d.user.id} value={d.user.id} disabled={d.busy || d.user.id === booking.driver?.id}>
            {d.user.name} - {d.profile!.isOnline ? 'online' : 'offline'}
            {d.busy ? ' - busy at this time' : ''}
            {d.user.id === booking.driver?.id ? ' - current' : ''}
          </option>
        ))}
      </select>
      <div className="row">
        <button onClick={assign} disabled={!driverId || action.busy}>
          Assign
        </button>
        <button className="secondary" onClick={onDone}>
          Close
        </button>
      </div>
      {action.error && <p className="error">{action.error}</p>}
    </div>
  );
}
