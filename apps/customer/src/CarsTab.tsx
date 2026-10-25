import { useState } from 'react';
import type { Car, CarInput } from '@chauffr/shared';
import { useAction, useLoad, useSession } from '@chauffr/ui';

const EMPTY: CarInput = { make: '', model: '', registration: '', transmission: 'manual', type: 'hatchback' };

export function CarsTab({ firstCar, onAdded }: { firstCar: boolean; onAdded(): void }) {
  const { api } = useSession();
  const { data: cars, reload } = useLoad(() => api<Car[]>('GET', '/customer/cars'), [api]);
  const [form, setForm] = useState<CarInput>(EMPTY);
  const add = useAction();
  const remove = useAction();

  const set = <K extends keyof CarInput>(key: K, value: CarInput[K]) => setForm((f) => ({ ...f, [key]: value }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    add.run(async () => {
      await api('POST', '/customer/cars', form);
      setForm(EMPTY);
      reload();
      onAdded();
    });
  };

  const del = (car: Car) => {
    if (!confirm(`Remove ${car.make} ${car.model}?`)) return;
    remove.run(async () => {
      await api('DELETE', `/customer/cars/${car.id}`);
      reload();
    });
  };

  return (
    <div className="stack">
      {firstCar && <p className="muted">Add the car you want driven. Drivers are matched by transmission.</p>}
      {cars?.map((c) => (
        <div key={c.id} className="card spread">
          <div>
            <strong>
              {c.make} {c.model}
            </strong>
            <p className="small muted">
              {c.registration} - {c.transmission} - {c.type}
            </p>
          </div>
          <button className="danger" onClick={() => del(c)} disabled={remove.busy}>
            Remove
          </button>
        </div>
      ))}
      {remove.error && <p className="error">{remove.error}</p>}

      <form className="card stack" onSubmit={submit}>
        <h3>Add a car</h3>
        <div className="row">
          <label style={{ flex: 1 }}>
            Make
            <input required placeholder="Maruti" value={form.make} onChange={(e) => set('make', e.target.value)} />
          </label>
          <label style={{ flex: 1 }}>
            Model
            <input required placeholder="Swift" value={form.model} onChange={(e) => set('model', e.target.value)} />
          </label>
        </div>
        <label>
          Registration number
          <input required placeholder="KA01AB1234" value={form.registration} onChange={(e) => set('registration', e.target.value)} />
        </label>
        <div className="row">
          <label style={{ flex: 1 }}>
            Transmission
            <select value={form.transmission} onChange={(e) => set('transmission', e.target.value as CarInput['transmission'])}>
              <option value="manual">Manual</option>
              <option value="automatic">Automatic</option>
            </select>
          </label>
          <label style={{ flex: 1 }}>
            Type
            <select value={form.type} onChange={(e) => set('type', e.target.value as CarInput['type'])}>
              <option value="hatchback">Hatchback</option>
              <option value="sedan">Sedan</option>
              <option value="suv">SUV</option>
              <option value="luxury">Luxury</option>
            </select>
          </label>
        </div>
        {add.error && <p className="error">{add.error}</p>}
        <button type="submit" disabled={add.busy}>
          {add.busy ? 'Adding...' : 'Add car'}
        </button>
      </form>
    </div>
  );
}
