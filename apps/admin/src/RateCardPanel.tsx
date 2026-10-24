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

  if (error) return <p className="error">{error}</p>;
  if (!card) return null;

  const hours = card.baseMinutes / 60;
  return (
    <section className="card stack">
      <div className="spread">
        <h2>Active rate card</h2>
        <span className="muted">{card.name}</span>
      </div>
      <div className="stats">
        <div className="stat"><strong>{formatINR(card.baseFare)}</strong><span className="muted">first {hours} hrs</span></div>
        <div className="stat"><strong>{formatINR(card.extraPer30Min)}</strong><span className="muted">per extra 30 min</span></div>
        <div className="stat"><strong>{formatINR(card.nightCharge)}</strong><span className="muted">night ({card.nightStartHour}:00–{card.nightEndHour}:00)</span></div>
        <div className="stat"><strong>{card.commissionBps / 100}%</strong><span className="muted">commission</span></div>
      </div>
    </section>
  );
}
