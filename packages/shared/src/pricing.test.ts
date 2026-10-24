import assert from 'node:assert/strict';
import { test } from 'node:test';
import { computeFare, overlapsNight, type RateCard } from './pricing';

const card: RateCard = {
  baseFare: 44_900,
  baseMinutes: 120,
  extraPer30Min: 9_900,
  nightCharge: 20_000,
  nightStartHour: 22,
  nightEndHour: 6,
  commissionBps: 2000,
};

// Builds a Date from an IST wall-clock time.
const ist = (iso: string) => new Date(`${iso}+05:30`);

test('short trip is billed the base fare', () => {
  const fare = computeFare(card, ist('2026-10-24T10:00'), ist('2026-10-24T11:15'));
  assert.equal(fare.total, 44_900);
  assert.equal(fare.extraBlocks, 0);
});

test('extra time is billed per started 30 minutes', () => {
  const fare = computeFare(card, ist('2026-10-24T10:00'), ist('2026-10-24T12:31'));
  assert.equal(fare.extraBlocks, 2);
  assert.equal(fare.total, 44_900 + 2 * 9_900);
});

test('commission and driver earning add up to the total', () => {
  const fare = computeFare(card, ist('2026-10-24T10:00'), ist('2026-10-24T13:00'));
  assert.equal(fare.commission, Math.round(fare.total * 0.2));
  assert.equal(fare.commission + fare.driverEarning, fare.total);
});

test('night window detection in IST', () => {
  assert.equal(overlapsNight(ist('2026-10-24T20:00'), ist('2026-10-24T22:30'), 22, 6), true);
  assert.equal(overlapsNight(ist('2026-10-25T05:00'), ist('2026-10-25T07:00'), 22, 6), true);
  assert.equal(overlapsNight(ist('2026-10-24T06:00'), ist('2026-10-24T22:00'), 22, 6), false);
  assert.equal(overlapsNight(ist('2026-10-24T23:00'), ist('2026-10-25T01:00'), 22, 6), true);
});

test('night charge is added once', () => {
  const fare = computeFare(card, ist('2026-10-24T21:00'), ist('2026-10-24T23:00'));
  assert.equal(fare.night, 20_000);
  assert.equal(fare.total, 44_900 + 20_000);
});
