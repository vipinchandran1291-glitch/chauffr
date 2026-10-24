import { useCallback, useEffect, useState, type FormEvent } from 'react';
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

export function Cars() {
  const [cars, setCars] = useState<Car[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setCars((await api.get<{ cars: Car[] }>('/api/cars')).cars);
    } catch (err) {
      setError(errorMessage(err));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function remove(car: Car) {
    if (!confirm(`Remove ${car.make} ${car.model} (${car.regNumber})?`)) return;
    try {
      await api.del(`/api/cars/${car.id}`);
      await load();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <section className="card stack">
      <div className="spread">
        <h2>My cars</h2>
        {!adding && <button type="button" className="secondary small" onClick={() => setAdding(true)}>Add car</button>}
      </div>
      {error && <p className="error">{error}</p>}
      {cars === null ? (
        <p className="muted">Loading…</p>
      ) : cars.length === 0 && !adding ? (
        <p className="muted">No cars yet. Drivers are matched to your car's transmission and size.</p>
      ) : (
        <ul className="list">
          {cars.map((car) => (
            <li key={car.id} className="spread">
              <div>
                <strong>{car.make} {car.model}</strong>
                <p className="muted">{car.regNumber} · {car.transmission} · {CAR_TYPE_LABELS[car.carType]}</p>
              </div>
              <button type="button" className="danger small" onClick={() => void remove(car)}>Remove</button>
            </li>
          ))}
        </ul>
      )}
      {adding && (
        <AddCarForm
          onDone={async (added) => {
            setAdding(false);
            if (added) await load();
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
        <label style={{ flex: 1 }}>
          Make
          <input value={make} onChange={(e) => setMake(e.target.value)} placeholder="Maruti" required />
        </label>
        <label style={{ flex: 1 }}>
          Model
          <input value={model} onChange={(e) => setModel(e.target.value)} placeholder="Swift" required />
        </label>
      </div>
      <label>
        Registration number
        <input value={regNumber} onChange={(e) => setRegNumber(e.target.value)} placeholder="KA 01 AB 1234" required />
      </label>
      <div className="row">
        <label style={{ flex: 1 }}>
          Transmission
          <select value={transmission} onChange={(e) => setTransmission(e.target.value as Transmission)}>
            {TRANSMISSIONS.map((t) => <option key={t} value={t}>{t === 'manual' ? 'Manual' : 'Automatic'}</option>)}
          </select>
        </label>
        <label style={{ flex: 1 }}>
          Type
          <select value={carType} onChange={(e) => setCarType(e.target.value as CarType)}>
            {CAR_TYPES.map((t) => <option key={t} value={t}>{CAR_TYPE_LABELS[t]}</option>)}
          </select>
        </label>
      </div>
      {error && <p className="error">{error}</p>}
      <div className="row">
        <button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save car'}</button>
        <button type="button" className="secondary" onClick={() => onDone(false)}>Cancel</button>
      </div>
    </form>
  );
}
