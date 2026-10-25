import { describe, expect, it } from 'vitest';
import { estimateFare, finalFare, overlapsNight } from './pricing.ts';
import type { RateCard } from './types.ts';

const card: RateCard = {
  minHours: 4,
  baseFare: 50_000,
  extraHourRate: 12_000,
  nightCharge: 20_000,
  graceMinutes: 15,
  commissionPct: 20,
};

// 10:00 IST
const morning = new Date('2026-11-02T04:30:00Z');
const hours = (h: number) => h * 3_600_000;

describe('overlapsNight', () => {
  it('is false for a daytime trip', () => {
    expect(overlapsNight(morning, new Date(morning.getTime() + hours(4)))).toBe(false);
  });
  it('is true when a trip runs past 22:00 IST', () => {
    const start = new Date('2026-11-02T14:30:00Z'); // 20:00 IST
    expect(overlapsNight(start, new Date(start.getTime() + hours(3)))).toBe(true);
  });
  it('is false for a trip ending exactly at 22:00 IST', () => {
    const start = new Date('2026-11-02T12:30:00Z'); // 18:00 IST
    expect(overlapsNight(start, new Date(start.getTime() + hours(4)))).toBe(false);
  });
  it('is true for an early-morning start', () => {
    expect(overlapsNight(new Date('2026-11-02T00:00:00Z'), new Date('2026-11-02T01:00:00Z'))).toBe(true);
  });
});

describe('estimateFare', () => {
  it('charges the minimum for short bookings', () => {
    const f = estimateFare(card, 2, morning);
    expect(f.billedHours).toBe(4);
    expect(f.total).toBe(50_000);
  });
  it('adds extra hours and splits commission', () => {
    const f = estimateFare(card, 6, morning);
    expect(f.total).toBe(74_000);
    expect(f.platformFee).toBe(14_800);
    expect(f.driverEarning).toBe(59_200);
  });
});

describe('finalFare', () => {
  it('applies the grace period before billing another hour', () => {
    const end = new Date(morning.getTime() + (5 * 60 + 10) * 60_000);
    expect(finalFare(card, morning, end).billedHours).toBe(5);
  });
  it('bills the next hour once grace is used up', () => {
    const end = new Date(morning.getTime() + (5 * 60 + 20) * 60_000);
    expect(finalFare(card, morning, end).billedHours).toBe(6);
  });
});
