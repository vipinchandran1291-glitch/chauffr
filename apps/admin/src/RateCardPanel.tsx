import { useEffect, useState } from 'react';
import type { RateCard } from '@chauffr/shared';
import { useAction, useLoad, useSession } from '@chauffr/ui';

/** Fields shown in rupees in the form but stored in paise. */
const MONEY: (keyof RateCard)[] = ['baseFare', 'extraHourRate', 'nightCharge'];

const FIELDS: { key: keyof RateCard; label: string }[] = [
  { key: 'minHours', label: 'Minimum hours' },
  { key: 'baseFare', label: 'Fare for minimum hours (₹)' },
  { key: 'extraHourRate', label: 'Each extra hour (₹)' },
  { key: 'nightCharge', label: 'Night charge, 10pm-6am (₹)' },
  { key: 'graceMinutes', label: 'Grace minutes before next hour' },
  { key: 'commissionPct', label: 'Chauffr commission (%)' },
];

export function RateCardPanel() {
  const { api } = useSession();
  const { data: card, reload } = useLoad(() => api<RateCard>('GET', '/admin/rate-card'), [api]);
  const [form, setForm] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);
  const action = useAction();

  useEffect(() => {
    if (!card) return;
    setForm(
      Object.fromEntries(FIELDS.map(({ key }) => [key, String(MONEY.includes(key) ? card[key] / 100 : card[key])])),
    );
  }, [card]);

  if (!card) return <p className="muted">Loading...</p>;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(false);
    const body = Object.fromEntries(
      FIELDS.map(({ key }) => [key, MONEY.includes(key) ? Math.round(Number(form[key]) * 100) : Number(form[key])]),
    );
    action.run(async () => {
      await api('PUT', '/admin/rate-card', body);
      reload();
      setSaved(true);
    });
  };

  return (
    <form className="card stack" onSubmit={submit}>
      <h2>Rate card</h2>
      <p className="small muted">Changes apply to new bookings only. Existing bookings keep the rates they were booked at.</p>
      {FIELDS.map(({ key, label }) => (
        <label key={key}>
          {label}
          <input type="number" min={0} step="any" required value={form[key] ?? ''} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
        </label>
      ))}
      {action.error && <p className="error">{action.error}</p>}
      {saved && <p className="small" style={{ color: 'var(--success)' }}>Saved.</p>}
      <button type="submit" disabled={action.busy}>
        Save rate card
      </button>
    </form>
  );
}
