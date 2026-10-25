import type { FareBreakdown, RateCard } from './types.ts';

const IST_OFFSET_MIN = 330;
const NIGHT_START_HOUR = 22;
const NIGHT_END_HOUR = 6;
const STEP_MS = 15 * 60_000;

function isNightIST(t: number): boolean {
  const istMinutes = Math.floor(t / 60_000) + IST_OFFSET_MIN;
  const hour = Math.floor((((istMinutes % 1440) + 1440) % 1440) / 60);
  return hour >= NIGHT_START_HOUR || hour < NIGHT_END_HOUR;
}

/** True if any part of [start, end) falls between 22:00 and 06:00 IST. */
export function overlapsNight(start: Date, end: Date): boolean {
  for (let t = start.getTime(); t < end.getTime(); t += STEP_MS) {
    if (isNightIST(t)) return true;
  }
  return isNightIST(end.getTime() - 1);
}

function breakdown(card: RateCard, hours: number, night: boolean): FareBreakdown {
  const billedHours = Math.max(card.minHours, hours);
  const extraHoursFare = (billedHours - card.minHours) * card.extraHourRate;
  const nightCharge = night ? card.nightCharge : 0;
  const total = card.baseFare + extraHoursFare + nightCharge;
  const platformFee = Math.round((total * card.commissionPct) / 100);
  return {
    minHours: card.minHours,
    billedHours,
    baseFare: card.baseFare,
    extraHoursFare,
    nightCharge,
    total,
    platformFee,
    driverEarning: total - platformFee,
  };
}

/** Fare shown at booking time, from the hours the customer asked for. */
export function estimateFare(card: RateCard, bookedHours: number, startAt: Date): FareBreakdown {
  const end = new Date(startAt.getTime() + bookedHours * 3_600_000);
  return breakdown(card, bookedHours, overlapsNight(startAt, end));
}

/** Fare charged at trip end, from the actual start and end times. */
export function finalFare(card: RateCard, startedAt: Date, endedAt: Date): FareBreakdown {
  const minutes = Math.max(0, (endedAt.getTime() - startedAt.getTime()) / 60_000);
  const hours = Math.ceil(Math.max(0, minutes - card.graceMinutes) / 60);
  return breakdown(card, hours, overlapsNight(startedAt, endedAt));
}

export function formatRupees(paise: number): string {
  const digits = paise % 100 === 0 ? 0 : 2;
  return '₹' + (paise / 100).toLocaleString('en-IN', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}
