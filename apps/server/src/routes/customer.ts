import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import { bookingInput, carInput, estimateFare, fareEstimateInput, type FareBreakdown, type PaymentOrder } from '@chauffr/shared';
import { requireUser, type AppEnv } from '../auth.ts';
import type { DB } from '../db.ts';
import type { PaymentGateway } from '../razorpay.ts';
import { markOrderPaid } from './payments.ts';
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

export function customerRoutes(db: DB, gateway: PaymentGateway) {
  const r = new Hono<AppEnv>();
  r.use(requireUser(db, ['customer']));

  const ownBooking = (customerId: number, id: number) => {
    const row = findBooking(db, id);
    if (row.customer_id !== customerId) throw notFound('Booking');
    return row;
  };

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
    return c.json(rowToBooking(ownBooking(c.get('user').id, idParam(c)), { includeOtp: true }));
  });

  r.post('/bookings/:id/pay', async (c) => {
    const user = c.get('user');
    const id = idParam(c);
    const row = ownBooking(user.id, id);
    if (row.status !== 'completed') throw conflict('You can pay once the trip has ended');
    if (row.payment_status === 'paid') throw conflict('This trip is already paid');
    if (!gateway.configured) throw new HTTPException(503, { message: 'Payments are not set up yet' });

    const amount = (JSON.parse(row.fare_json as string) as FareBreakdown).total;
    // Reuse an open order so retrying Checkout doesn't pile up orders on Razorpay.
    const open = db
      .prepare(`SELECT razorpay_order_id FROM payments WHERE booking_id = ? AND status = 'created' AND amount = ? ORDER BY id DESC`)
      .get(id, amount);
    let orderId = open?.razorpay_order_id as string | undefined;
    if (!orderId) {
      const order = await gateway.createOrder({ amount, receipt: `booking_${id}`, notes: { bookingId: String(id) } });
      orderId = order.id;
      db.prepare('INSERT INTO payments (booking_id, razorpay_order_id, amount) VALUES (?, ?, ?)').run(id, orderId, amount);
    }
    const order: PaymentOrder = {
      keyId: gateway.keyId,
      orderId,
      amount,
      currency: 'INR',
      prefill: { name: user.name, email: user.email, contact: user.phone ? `+91${user.phone}` : '' },
    };
    return c.json(order);
  });

  r.post('/bookings/:id/pay/verify', async (c) => {
    const input = await parseBody(
      c,
      z.object({
        razorpayOrderId: z.string().min(1),
        razorpayPaymentId: z.string().min(1),
        razorpaySignature: z.string().min(1),
      }),
    );
    const id = idParam(c);
    ownBooking(c.get('user').id, id);
    const payment = db
      .prepare('SELECT id FROM payments WHERE razorpay_order_id = ? AND booking_id = ?')
      .get(input.razorpayOrderId, id);
    if (!payment) throw notFound('Payment');
    if (!gateway.verifyPaymentSignature(input.razorpayOrderId, input.razorpayPaymentId, input.razorpaySignature)) {
      throw new HTTPException(400, { message: 'Payment could not be verified' });
    }
    markOrderPaid(db, input.razorpayOrderId, input.razorpayPaymentId);
    return c.json(rowToBooking(findBooking(db, id), { includeOtp: true }));
  });

  r.post('/bookings', async (c) => {
    const user = c.get('user');
    if (!user.phone) throw new HTTPException(400, { message: 'Add your phone number before booking' });
    const input = await parseBody(c, bookingInput);

    const unpaid = db
      .prepare(`SELECT id FROM bookings WHERE customer_id = ? AND status = 'completed' AND payment_status = 'unpaid'`)
      .get(user.id);
    if (unpaid) throw conflict('Please pay for your last trip before booking again');

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
    const row = ownBooking(c.get('user').id, id);
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
