import { useEffect, useState } from 'react';
import { createApi, SessionGate, Shell, useSession } from '@chauffr/ui';
import { BookTab } from './BookTab.tsx';
import { CarsTab } from './CarsTab.tsx';
import { TripsTab } from './TripsTab.tsx';

const api = createApi('customer');

type TabId = 'book' | 'trips' | 'cars';

export function App() {
  return (
    <SessionGate api={api} title="Chauffr" tagline="A trusted driver for your car, in minutes.">
      <Home />
    </SessionGate>
  );
}

function Home() {
  const { api } = useSession();
  const [tab, setTab] = useState<TabId>('book');
  const [hasCars, setHasCars] = useState<boolean | null>(null);

  useEffect(() => {
    api<unknown[]>('GET', '/customer/cars').then((cars) => {
      setHasCars(cars.length > 0);
      if (!cars.length) setTab('cars');
    });
  }, [api]);

  return (
    <Shell<TabId>
      title="Chauffr"
      tabs={[
        { id: 'book', label: 'Book' },
        { id: 'trips', label: 'My trips' },
        { id: 'cars', label: 'My cars' },
      ]}
      active={tab}
      onTab={setTab}
    >
      {tab === 'book' && <BookTab onBooked={() => setTab('trips')} onNeedCar={() => setTab('cars')} />}
      {tab === 'trips' && <TripsTab />}
      {tab === 'cars' && <CarsTab firstCar={hasCars === false} onAdded={() => (setHasCars(true), setTab('book'))} />}
    </Shell>
  );
}
