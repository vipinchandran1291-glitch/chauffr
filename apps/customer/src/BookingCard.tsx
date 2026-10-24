import { useMemo, useState } from 'react';
import { computeFare, formatINR, type Car, type PublicRateCard } from '@chauffr/shared';
import { Icon } from '@chauffr/ui';

const DURATIONS_HOURS = [2, 4, 6, 8, 12];

/** Value for a datetime-local input, rounded up to the next 15 minutes, at least an hour from now. */
function defaultScheduleTime(): string {
  const d = new Date(Date.now() + 60 * 60_000);
  d.setMinutes(Math.ceil(d.getMinutes() / 15) * 15, 0, 0);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function estimate(card: PublicRateCard, start: Date, hours: number) {
  return computeFare({ ...card, commissionBps: 0 }, start, new Date(start.getTime() + hours * 3_600_000));
}

export function BookingCard({ cars, rateCard }: { cars: Car[]; rateCard: PublicRateCard | null }) {
  const [when, setWhen] = useState<'now' | 'later'>('now');
  const [scheduledAt, setScheduledAt] = useState(defaultScheduleTime);
  const [hours, setHours] = useState(4);
  const [pickup, setPickup] = useState('');
  const [carId, setCarId] = useState<number | ''>('');

  const selectedCar = cars.find((c) => c.id === carId) ?? cars[0];
  const start = useMemo(() => (when === 'now' ? new Date() : new Date(scheduledAt)), [when, scheduledAt]);
  const fare = rateCard && !Number.isNaN(start.getTime()) ? estimate(rateCard, start, hours) : null;

  return (
    <section className="card booking-card">
      <div className="stack">
        <div className="card-header">
          <h2>Book a driver</h2>
          <span className="badge verified"><Icon name="shieldCheck" size={14} /> Verified drivers only</span>
        </div>

        <div className="segmented" role="tablist">
          <button type="button" role="tab" aria-selected={when === 'now'} className={when === 'now' ? 'active' : ''} onClick={() => setWhen('now')}>
            <Icon name="clock" size={18} /> Now
          </button>
          <button type="button" role="tab" aria-selected={when === 'later'} className={when === 'later' ? 'active' : ''} onClick={() => setWhen('later')}>
            Schedule
          </button>
        </div>

        <label>
          Pickup location
          <div className="input-icon">
            <Icon name="pin" size={18} />
            <input value={pickup} onChange={(e) => setPickup(e.target.value)} placeholder="Where is your car parked?" />
          </div>
        </label>

        {when === 'later' && (
          <label>
            Date and time
            <input type="datetime-local" value={scheduledAt} min={defaultScheduleTime()} onChange={(e) => setScheduledAt(e.target.value)} />
          </label>
        )}

        <div className="stack-sm">
          <span className="small" style={{ fontWeight: 600 }}>How long do you need the driver?</span>
          <div className="duration-grid">
            {DURATIONS_HOURS.map((h) => (
              <button key={h} type="button" className={`duration ${h === hours ? 'active' : ''}`} onClick={() => setHours(h)}>
                <strong>{h} hrs</strong>
                <span>{rateCard ? formatINR(estimate(rateCard, start, h).total) : '…'}</span>
              </button>
            ))}
          </div>
        </div>

        <label>
          Car
          {cars.length > 0 ? (
            <select value={selectedCar?.id ?? ''} onChange={(e) => setCarId(Number(e.target.value))}>
              {cars.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.make} {c.model} · {c.regNumber}
                </option>
              ))}
            </select>
          ) : (
            <span className="hint">Add your car below so we send a driver who can drive it.</span>
          )}
        </label>
      </div>

      <div className="fare-bar">
        <div>
          <div className="muted small">Estimated fare · pay after the trip</div>
          <div className="amount">{fare ? formatINR(fare.total) : '—'}</div>
          {rateCard && (
            <div className="muted small">
              {formatINR(rateCard.baseFare)} for {rateCard.baseMinutes / 60} hrs, then {formatINR(rateCard.extraPer30Min)} per 30 min
              {fare && fare.night > 0 && ` · incl. ${formatINR(fare.night)} night charge`}
            </div>
          )}
        </div>
        <button type="button" disabled title="Booking opens in the next update">Booking opens soon</button>
      </div>
    </section>
  );
}
