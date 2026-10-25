import { useState } from 'react';
import { createApi, SessionGate, Shell } from '@chauffr/ui';
import { Bookings } from './Bookings.tsx';
import { Drivers } from './Drivers.tsx';
import { RateCardPanel } from './RateCardPanel.tsx';

const api = createApi('admin');

type TabId = 'bookings' | 'drivers' | 'rates';

export function App() {
  const [tab, setTab] = useState<TabId>('bookings');
  return (
    <SessionGate api={api} title="Chauffr Ops" tagline="Operations dashboard">
      <Shell<TabId>
        title="Chauffr Ops"
        tabs={[
          { id: 'bookings', label: 'Bookings' },
          { id: 'drivers', label: 'Drivers' },
          { id: 'rates', label: 'Rate card' },
        ]}
        active={tab}
        onTab={setTab}
      >
        {tab === 'bookings' && <Bookings />}
        {tab === 'drivers' && <Drivers />}
        {tab === 'rates' && <RateCardPanel />}
      </Shell>
    </SessionGate>
  );
}
