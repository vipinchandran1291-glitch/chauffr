import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import { bookingInput, carInput, estimateFare, fareEstimateInput } from '@chauffr/shared';
import { requireUser, type AppEnv } from '../auth.ts';
import type { DB } from '../db.ts';
import {
  BOOKING_SELECT,
  conflict,
  findBooking,
  getRateCard,
  idParam,
  newOtp,
  notFound,
  parseBody,
  rowToBooking,
  rowToCar,
} from '../model.ts';

const MAX_ADVANCE_DAYS = 30;
const PAST_TOLERANCE_MS = 5 * 60_000;

export function customerRoutes(db: DB) {
  const r = new Hono<AppEnv>();
  r.use(requireUser(db, ['customer']));

  r.get('/cars', (c) => {
    const rows = db
      .prepare('SELECT * FROM cars WHERE owner_id = ? AND deleted_at IS NULL ORDER BY id')
      .all(c.get('user').id);
    return c.json(rows.map(rowToCar));
  });

  r.post('/cars', async (c) => {
    const input = await parseBody(c, carInput);
    const row = db
      .prepare(
        'INSERT INTO cars (owner_id, make, model, registration, transmission, type) VALUES (?, ?, ?, ?, ?, ?) RETURNING *',
      )
      .get(c.get('user').id, input.make, input.model, input.registration, input.transmission, input.type)!;
    return c.json(rowToCar(row), 201);
  });

  // Soft delete: past bookings still reference the car.
  r.delete('/cars/:id', (c) => {
    const { changes } = db
      .prepare(`UPDATE cars SET deleted_at = ? WHERE id = ? AND owner_id = ? AND deleted_at IS NULL`)
      .run(new Date().toISOString(), idParam(c), c.get('user').id);
    if (!changes) throw notFound('Car');
    return c.json({ ok: true });
  });

  r.post('/fare-estimate', async (c) => {
    const input = await parseBody(c, fareEstimateInput);
    return c.json(estimateFare(getRateCard(db), input.bookedHours, new Date(input.scheduledAt)));
  });

  r.get('/bookings', (c) => {
    const rows = db
      .prepare(`${BOOKING_SELECT} WHERE b.customer_id = ? ORDER BY b.scheduled_at DESC LIMIT 50`)
      .all(c.get('user').id);
    return c.json(rows.map((row) => rowToBooking(row, { includeOtp: true })));
  });

  r.get('/bookings/:id', (c) => {
    const row = findBooking(db, idParam(c));
    if (row.customer_id !== c.get('user').id) throw notFound('Booking');
    return c.json(rowToBooking(row, { includeOtp: true }));
  });

  r.post('/bookings', async (c) => {
    const user = c.get('user');
    if (!user.phone) throw new HTTPException(400, { message: 'Add your phone number before booking' });
    const input = await parseBody(c, bookingInput);

    const car = db
      .prepare('SELECT id FROM cars WHERE id = ? AND owner_id = ? AND deleted_at IS NULL')
      .get(input.carId, user.id);
    if (!car) throw notFound('Car');

    const scheduledAt = new Date(input.scheduledAt);
    const now = Date.now();
    if (scheduledAt.getTime() < now - PAST_TOLERANCE_MS) {
      throw new HTTPException(400, { message: 'Pickup time is in the past' });
    }
    if (scheduledAt.getTime() > now + MAX_ADVANCE_DAYS * 86_400_000) {
      throw new HTTPException(400, { message: `Bookings can be made up to ${MAX_ADVANCE_DAYS} days ahead` });
    }

    const rateCard = getRateCard(db);
    const estimate = estimateFare(rateCard, input.bookedHours, scheduledAt);
    const { id } = db
      .prepare(
        `INSERT INTO bookings (customer_id, car_id, status, pickup_address, scheduled_at, booked_hours,
           estimated_fare, rate_card_json, start_otp)
         VALUES (?, ?, 'requested', ?, ?, ?, ?, ?, ?) RETURNING id`,
      )
      .get(
        user.id,
        input.carId,
        input.pickupAddress,
        scheduledAt.toISOString(),
        input.bookedHours,
        estimate.total,
        JSON.stringify(rateCard),
        newOtp(),
      )!;
    return c.json(rowToBooking(findBooking(db, id as number), { includeOtp: true }), 201);
  });

  r.post('/bookings/:id/cancel', async (c) => {
    const { reason } = await parseBody(c, z.object({ reason: z.string().trim().max(200).default('') }));
    const id = idParam(c);
    const row = findBooking(db, id);
    if (row.customer_id !== c.get('user').id) throw notFound('Booking');
    if (row.status !== 'requested' && row.status !== 'assigned') {
      throw conflict('This booking can no longer be cancelled');
    }
    db.prepare(`UPDATE bookings SET status = 'cancelled', cancel_reason = ? WHERE id = ?`).run(
      reason || 'Cancelled by customer',
      id,
    );
    return c.json(rowToBooking(findBooking(db, id), { includeOtp: true }));
  });

  return r;
}
