import { useEffect, useState } from 'react';
import { formatRupees, type Car, type FareBreakdown } from '@chauffr/shared';
import { useAction, useLoad, useSession } from '@chauffr/ui';

/** Next quarter hour at least 30 minutes away, as a datetime-local value. */
function defaultPickup(): string {
  const d = new Date(Date.now() + 30 * 60_000);
  d.setMinutes(Math.ceil(d.getMinutes() / 15) * 15, 0, 0);
  return toLocalInput(d);
}

function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function BookTab({ onBooked, onNeedCar }: { onBooked(): void; onNeedCar(): void }) {
  const { api } = useSession();
  const { data: cars } = useLoad(() => api<Car[]>('GET', '/customer/cars'), [api]);
  const [carId, setCarId] = useState<number | null>(null);
  const [pickupAddress, setPickupAddress] = useState('');
  const [pickupAt, setPickupAt] = useState(defaultPickup);
  const [hours, setHours] = useState(4);
  const [estimate, setEstimate] = useState<FareBreakdown | null>(null);
  const action = useAction();

  useEffect(() => {
    if (cars?.length && carId === null) setCarId(cars[0]!.id);
  }, [cars, carId]);

  useEffect(() => {
    const scheduledAt = new Date(pickupAt);
    if (Number.isNaN(scheduledAt.getTime())) return setEstimate(null);
    const timer = setTimeout(() => {
      api<FareBreakdown>('POST', '/customer/fare-estimate', { bookedHours: hours, scheduledAt: scheduledAt.toISOString() })
        .then(setEstimate, () => setEstimate(null));
    }, 250);
    return () => clearTimeout(timer);
  }, [api, hours, pickupAt]);

  if (!cars) return <p className="muted">Loading...</p>;
  if (!cars.length) {
    return (
      <div className="card empty">
        <p>Add your car first so we can send a driver who can drive it.</p>
        <button onClick={onNeedCar}>Add a car</button>
      </div>
    );
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    action.run(async () => {
      await api('POST', '/customer/bookings', {
        carId,
        pickupAddress,
        scheduledAt: new Date(pickupAt).toISOString(),
        bookedHours: hours,
      });
      onBooked();
    });
  };

  return (
    <form className="stack" onSubmit={submit}>
      <h2>Book a driver</h2>
      <label>
        Car
        <select value={carId ?? ''} onChange={(e) => setCarId(Number(e.target.value))}>
          {cars.map((c) => (
            <option key={c.id} value={c.id}>
              {c.make} {c.model} - {c.registration} ({c.transmission})
            </option>
          ))}
        </select>
      </label>
      <label>
        Pickup address
        <textarea required rows={2} minLength={5} placeholder="House / street / landmark, area" value={pickupAddress} onChange={(e) => setPickupAddress(e.target.value)} />
      </label>
      <div className="row">
        <label style={{ flex: 2 }}>
          Pickup time
          <input type="datetime-local" required value={pickupAt} min={toLocalInput(new Date())} onChange={(e) => setPickupAt(e.target.value)} />
        </label>
        <label style={{ flex: 1 }}>
          Hours
          <select value={hours} onChange={(e) => setHours(Number(e.target.value))}>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => (
              <option key={h} value={h}>
                {h} hr{h > 1 ? 's' : ''}
              </option>
            ))}
          </select>
        </label>
      </div>

      {estimate && (
        <div className="card">
          <div className="spread">
            <span className="muted">Estimated fare</span>
            <span className="amount">{formatRupees(estimate.total)}</span>
          </div>
          <div className="fare-lines muted">
            <span>First {estimate.minHours} hours (minimum)</span>
            <span>{formatRupees(estimate.baseFare)}</span>
            {estimate.extraHoursFare > 0 && (
              <>
                <span>Extra hours</span>
                <span>{formatRupees(estimate.extraHoursFare)}</span>
              </>
            )}
            {estimate.nightCharge > 0 && (
              <>
                <span>Night charge (10pm-6am)</span>
                <span>{formatRupees(estimate.nightCharge)}</span>
              </>
            )}
          </div>
          <p className="small muted">Final fare is based on actual trip time. You pay after the trip.</p>
        </div>
      )}

      {action.error && <p className="error">{action.error}</p>}
      <button type="submit" disabled={action.busy || !carId}>
        {action.busy ? 'Booking...' : 'Request driver'}
      </button>
    </form>
  );
}
