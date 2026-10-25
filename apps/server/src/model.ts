import { randomInt } from 'node:crypto';
import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { z } from 'zod';
import type { Booking, Car, DriverProfile, RateCard } from '@chauffr/shared';
import type { DB } from './db.ts';

type Row = Record<string, unknown>;

export async function parseBody<S extends z.ZodType>(c: Context, schema: S): Promise<z.output<S>> {
  const body = await c.req.json().catch(() => {
    throw new HTTPException(400, { message: 'Invalid JSON body' });
  });
  const result = schema.safeParse(body);
  if (!result.success) {
    const issue = result.error.issues[0]!;
    const field = issue.path.join('.');
    throw new HTTPException(400, { message: field ? `${field}: ${issue.message}` : issue.message });
  }
  return result.data;
}

export const notFound = (what: string) => new HTTPException(404, { message: `${what} not found` });
export const conflict = (message: string) => new HTTPException(409, { message });

export function idParam(c: Context): number {
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id) || id <= 0) throw new HTTPException(400, { message: 'Invalid id' });
  return id;
}

export const newOtp = () => String(randomInt(0, 10_000)).padStart(4, '0');

export function rowToCar(r: Row): Car {
  return {
    id: r.id as number,
    make: r.make as string,
    model: r.model as string,
    registration: r.registration as string,
    transmission: r.transmission as Car['transmission'],
    type: r.type as Car['type'],
  };
}

export function rowToDriverProfile(r: Row): DriverProfile {
  return {
    userId: r.user_id as number,
    licenseNumber: r.license_number as string,
    licenseExpiry: r.license_expiry as string,
    transmission: r.transmission as DriverProfile['transmission'],
    status: r.status as DriverProfile['status'],
    isOnline: r.is_online === 1,
    adminNote: (r.admin_note as string | null) ?? null,
  };
}

export function getRateCard(db: DB): RateCard {
  const r = db.prepare('SELECT * FROM rate_card WHERE id = 1').get()!;
  return {
    minHours: r.min_hours as number,
    baseFare: r.base_fare as number,
    extraHourRate: r.extra_hour_rate as number,
    nightCharge: r.night_charge as number,
    graceMinutes: r.grace_minutes as number,
    commissionPct: r.commission_pct as number,
  };
}

export const BOOKING_SELECT = `
  SELECT b.*,
    c.make, c.model, c.registration, c.transmission AS car_transmission, c.type AS car_type,
    cu.name AS customer_name, cu.phone AS customer_phone,
    d.name AS driver_name, d.phone AS driver_phone
  FROM bookings b
  JOIN cars c ON c.id = b.car_id
  JOIN users cu ON cu.id = b.customer_id
  LEFT JOIN users d ON d.id = b.driver_id`;

export function rowToBooking(r: Row, opts: { includeOtp?: boolean } = {}): Booking {
  return {
    id: r.id as number,
    status: r.status as Booking['status'],
    pickupAddress: r.pickup_address as string,
    scheduledAt: r.scheduled_at as string,
    bookedHours: r.booked_hours as number,
    estimatedFare: r.estimated_fare as number,
    car: {
      id: r.car_id as number,
      make: r.make as string,
      model: r.model as string,
      registration: r.registration as string,
      transmission: r.car_transmission as Car['transmission'],
      type: r.car_type as Car['type'],
    },
    customer: { id: r.customer_id as number, name: r.customer_name as string, phone: r.customer_phone as string | null },
    driver: r.driver_id
      ? { id: r.driver_id as number, name: r.driver_name as string, phone: r.driver_phone as string | null }
      : null,
    ...(opts.includeOtp ? { startOtp: r.start_otp as string } : {}),
    startedAt: (r.started_at as string | null) ?? null,
    endedAt: (r.ended_at as string | null) ?? null,
    fare: r.fare_json ? JSON.parse(r.fare_json as string) : null,
    cancelReason: (r.cancel_reason as string | null) ?? null,
    createdAt: r.created_at as string,
  };
}

export function findBooking(db: DB, id: number): Row {
  const row = db.prepare(`${BOOKING_SELECT} WHERE b.id = ?`).get(id);
  if (!row) throw notFound('Booking');
  return row;
}
