import { eq } from 'drizzle-orm';
import { db } from './index';
import { rateCards } from './schema';

/** Starting Bangalore rates; change them from the admin dashboard once that screen exists. */
export function ensureDefaultRateCard(): void {
  if (db.select({ id: rateCards.id }).from(rateCards).where(eq(rateCards.active, true)).get()) return;
  db.insert(rateCards)
    .values({
      name: 'Bangalore default',
      baseFare: 44_900, // ₹449 for the first 2 hours
      baseMinutes: 120,
      extraPer30Min: 9_900, // ₹99 per started 30 minutes after that
      nightCharge: 20_000, // ₹200 if the trip overlaps 10pm–6am
      nightStartHour: 22,
      nightEndHour: 6,
      commissionBps: 2000, // 20%
      active: true,
    })
    .run();
}
