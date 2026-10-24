import { useState, type FormEvent } from 'react';
import {
  api,
  CAR_TYPE_LABELS,
  CAR_TYPES,
  errorMessage,
  TRANSMISSIONS,
  type Car,
  type CarType,
  type Transmission,
} from '@chauffr/shared';
import { Icon } from '@chauffr/ui';

export function Cars({ cars, onChange }: { cars: Car[] | null; onChange(): Promise<void> }) {
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');

  async function remove(car: Car) {
    if (!confirm(`Remove ${car.make} ${car.model} (${car.regNumber})?`)) return;
    try {
      await api.del(`/api/cars/${car.id}`);
      await onChange();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <section className="card stack">
      <div className="card-header">
        <h2>My garage</h2>
        {!adding && (
          <button type="button" className="secondary sm" onClick={() => setAdding(true)}>
            <Icon name="plus" size={16} /> Add car
          </button>
        )}
      </div>
      {error && <p className="error small">{error}</p>}
      {cars === null ? (
        <p className="muted">Loading…</p>
      ) : cars.length === 0 && !adding ? (
        <div className="empty">
          <Icon name="car" size={28} />
          <span>No cars yet. We match drivers to your car's transmission and size.</span>
          <button type="button" className="sm" onClick={() => setAdding(true)}>Add your car</button>
        </div>
      ) : (
        <ul className="list">
          {cars.map((car) => (
            <li key={car.id} className="list-item">
              <span className="icon-tile"><Icon name="car" /></span>
              <div className="grow">
                <strong>{car.make} {car.model}</strong>
                <div className="muted small">
                  {car.regNumber} · <span style={{ textTransform: 'capitalize' }}>{car.transmission}</span> · {CAR_TYPE_LABELS[car.carType]}
                </div>
              </div>
              <button type="button" className="danger sm" aria-label={`Remove ${car.make} ${car.model}`} onClick={() => void remove(car)}>
                <Icon name="trash" size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}
      {adding && (
        <AddCarForm
          onDone={async (added) => {
            setAdding(false);
            if (added) await onChange();
          }}
        />
      )}
    </section>
  );
}

function AddCarForm({ onDone }: { onDone(added: boolean): void }) {
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [regNumber, setRegNumber] = useState('');
  const [transmission, setTransmission] = useState<Transmission>('manual');
  const [carType, setCarType] = useState<CarType>('hatchback');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.post('/api/cars', { make, model, regNumber, transmission, carType });
      onDone(true);
    } catch (err) {
      setError(errorMessage(err));
      setSaving(false);
    }
  }

  return (
    <form className="stack" onSubmit={submit}>
      <div className="row">
        <label className="grow">
          Make
          <input value={make} onChange={(e) => setMake(e.target.value)} placeholder="Maruti" required />
        </label>
        <label className="grow">
          Model
          <input value={model} onChange={(e) => setModel(e.target.value)} placeholder="Swift" required />
        </label>
      </div>
      <label>
        Registration number
        <input value={regNumber} onChange={(e) => setRegNumber(e.target.value)} placeholder="KA 01 AB 1234" required />
      </label>
      <fieldset>
        <legend>Transmission</legend>
        <div className="choice-group">
          {TRANSMISSIONS.map((t) => (
            <label key={t} className="choice">
              <input type="radio" name="transmission" checked={transmission === t} onChange={() => setTransmission(t)} />
              {t === 'manual' ? 'Manual' : 'Automatic'}
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend>Car type</legend>
        <div className="choice-group">
          {CAR_TYPES.map((t) => (
            <label key={t} className="choice">
              <input type="radio" name="carType" checked={carType === t} onChange={() => setCarType(t)} />
              {CAR_TYPE_LABELS[t]}
            </label>
          ))}
        </div>
      </fieldset>
      {error && <p className="error small">{error}</p>}
      <div className="row">
        <button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save car'}</button>
        <button type="button" className="secondary" onClick={() => onDone(false)}>Cancel</button>
      </div>
    </form>
  );
}
