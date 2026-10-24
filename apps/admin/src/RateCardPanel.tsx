import { useEffect, useState } from 'react';
import { api, errorMessage, formatINR, type RateCard } from '@chauffr/shared';

type ActiveRateCard = RateCard & { name: string };

export function RateCardPanel() {
  const [card, setCard] = useState<ActiveRateCard | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get<{ rateCard: ActiveRateCard | null }>('/api/admin/rate-card').then(
      (r) => setCard(r.rateCard),
      (err) => setError(errorMessage(err)),
    );
  }, []);

  if (error) return <p className="alert danger small">{error}</p>;
  if (!card) return null;

  return (
    <section className="card stack">
      <div className="card-header">
        <h2>Active rate card</h2>
        <span className="muted small">{card.name}</span>
      </div>
      <div className="stats">
        <div className="stat"><span className="label">First {card.baseMinutes / 60} hrs</span><span className="value">{formatINR(card.baseFare)}</span></div>
        <div className="stat"><span className="label">Per extra 30 min</span><span className="value">{formatINR(card.extraPer30Min)}</span></div>
        <div className="stat"><span className="label">Night ({card.nightStartHour}:00–{card.nightEndHour}:00)</span><span className="value">{formatINR(card.nightCharge)}</span></div>
        <div className="stat"><span className="label">Commission</span><span className="value">{card.commissionBps / 100}%</span></div>
      </div>
    </section>
  );
}
