/** All amounts are integer paise. A copy of the rate card is stored on each booking. */
export interface RateCard {
  baseFare: number;
  baseMinutes: number;
  extraPer30Min: number;
  nightCharge: number;
  /** Night window in IST hours, e.g. 22 → 6. */
  nightStartHour: number;
  nightEndHour: number;
  /** Platform share in basis points, 2000 = 20%. */
  commissionBps: number;
}

export interface FareBreakdown {
  minutes: number;
  extraBlocks: number;
  base: number;
  extra: number;
  night: number;
  total: number;
  commission: number;
  driverEarning: number;
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const IST_OFFSET = 330 * MINUTE;

export function overlapsNight(start: Date, end: Date, startHour: number, endHour: number): boolean {
  const s = start.getTime() + IST_OFFSET;
  const e = end.getTime() + IST_OFFSET;
  // Start from the previous IST day so a window that began yesterday evening is included.
  for (let day = Math.floor(s / DAY) * DAY - DAY; day <= e; day += DAY) {
    const windowStart = day + startHour * HOUR;
    const windowEnd = day + (endHour <= startHour ? DAY : 0) + endHour * HOUR;
    if (s < windowEnd && e > windowStart) return true;
  }
  return false;
}

export function computeFare(card: RateCard, startedAt: Date, endedAt: Date): FareBreakdown {
  const minutes = Math.max(0, Math.ceil((endedAt.getTime() - startedAt.getTime()) / MINUTE));
  const extraBlocks = Math.max(0, Math.ceil((minutes - card.baseMinutes) / 30));
  const extra = extraBlocks * card.extraPer30Min;
  const night = overlapsNight(startedAt, endedAt, card.nightStartHour, card.nightEndHour) ? card.nightCharge : 0;
  const total = card.baseFare + extra + night;
  const commission = Math.round((total * card.commissionBps) / 10_000);
  return { minutes, extraBlocks, base: card.baseFare, extra, night, total, commission, driverEarning: total - commission };
}

export function formatINR(paise: number): string {
  return '₹' + (paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 });
}
