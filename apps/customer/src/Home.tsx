import { useCallback, useEffect, useState } from 'react';
import { api, errorMessage, type Car, type PublicRateCard } from '@chauffr/shared';
import { Icon, useSession } from '@chauffr/ui';
import { BookingCard } from './BookingCard';
import { Cars } from './Cars';

function greeting(): string {
  const hour = new Date().getHours();
  return hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
}

export function Home() {
  const { user } = useSession();
  const [cars, setCars] = useState<Car[] | null>(null);
  const [rateCard, setRateCard] = useState<PublicRateCard | null>(null);
  const [error, setError] = useState('');

  const loadCars = useCallback(async () => {
    try {
      setCars((await api.get<{ cars: Car[] }>('/api/cars')).cars);
    } catch (err) {
      setError(errorMessage(err));
    }
  }, []);

  useEffect(() => {
    void loadCars();
    api.get<{ rateCard: PublicRateCard | null }>('/api/rate-card').then((r) => setRateCard(r.rateCard), () => {});
  }, [loadCars]);

  const firstName = user?.name.split(' ')[0];

  return (
    <>
      <div className="greeting">
        <h1>{greeting()}{firstName ? `, ${firstName}` : ''}</h1>
        <p>Where do you need a driver today?</p>
      </div>

      <BookingCard cars={cars ?? []} rateCard={rateCard} />

      <div className="trust-strip">
        <div className="trust-item"><Icon name="shieldCheck" /><strong>Verified drivers</strong>Background checked</div>
        <div className="trust-item"><Icon name="lock" /><strong>OTP start</strong>Only your driver can start</div>
        <div className="trust-item"><Icon name="wallet" /><strong>Pay after trip</strong>UPI, card or cash</div>
      </div>

      {error && <p className="alert danger small">{error}</p>}
      <Cars cars={cars} onChange={loadCars} />
    </>
  );
}
