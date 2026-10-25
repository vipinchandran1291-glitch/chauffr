import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import {
  rateCardInput,
  type AdminDriver,
  type BookingStatus,
  type DriverOwed,
  type DriverStatus,
  type Payout,
} from '@chauffr/shared';
import { requireUser, rowToUser, type AppEnv } from '../auth.ts';
import { transaction, type DB } from '../db.ts';
import {
  BOOKING_SELECT,
  conflict,
  findBooking,
  getRateCard,
  idParam,
  notFound,
  parseBody,
  rowToBooking,
  rowToDriverProfile,
} from '../model.ts';

const DRIVER_STATUSES: DriverStatus[] = ['pending', 'approved', 'rejected', 'suspended'];
const BOOKING_STATUSES: BookingStatus[] = ['requested', 'assigned', 'in_progress', 'completed', 'cancelled'];

type Row = Record<string, unknown>;

const endOf = (b: Row) => new Date(b.scheduled_at as string).getTime() + (b.booked_hours as number) * 3_600_000;

export function adminRoutes(db: DB) {
  const r = new Hono<AppEnv>();
  r.use(requireUser(db, ['admin']));

  const DRIVER_SELECT = `
    SELECT u.*, p.user_id, p.license_number, p.license_expiry, p.transmission, p.status, p.is_online, p.admin_note
    FROM users u LEFT JOIN driver_profiles p ON p.user_id = u.id
    WHERE u.role = 'driver'`;

  const toAdminDriver = (row: Row): AdminDriver => ({
    user: rowToUser(row),
    profile: row.user_id ? rowToDriverProfile(row) : null,
  });

  /** Active bookings for this driver whose time window overlaps the given booking. */
  const clashes = (driverId: number, booking: Row) =>
    db
      .prepare(`SELECT * FROM bookings WHERE driver_id = ? AND id != ? AND status IN ('assigned', 'in_progress')`)
      .all(driverId, booking.id as number)
      .filter((other) => {
        const start = new Date(booking.scheduled_at as string).getTime();
        return new Date(other.scheduled_at as string).getTime() < endOf(booking) && endOf(other) > start;
      });

  const canDrive = (driverTransmission: unknown, carTransmission: unknown) =>
    driverTransmission === 'both' || driverTransmission === carTransmission;

  r.get('/drivers', (c) => {
    const status = c.req.query('status') as DriverStatus | undefined;
    const rows =
      status && DRIVER_STATUSES.includes(status)
        ? db.prepare(`${DRIVER_SELECT} AND p.status = ? ORDER BY p.updated_at`).all(status)
        : db.prepare(`${DRIVER_SELECT} ORDER BY u.created_at DESC`).all();
    return c.json(rows.map(toAdminDriver));
  });

  r.post('/drivers/:id/status', async (c) => {
    const input = await parseBody(
      c,
      z.object({ status: z.enum(DRIVER_STATUSES), note: z.string().trim().max(300).optional() }),
    );
    const id = idParam(c);
    const { changes } = db
      .prepare(
        `UPDATE driver_profiles SET status = ?, admin_note = ?,
           is_online = CASE WHEN ? = 'approved' THEN is_online ELSE 0 END,
           updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
         WHERE user_id = ?`,
      )
      .run(input.status, input.note || null, input.status, id);
    if (!changes) throw notFound('Driver profile');
    return c.json(toAdminDriver(db.prepare(`${DRIVER_SELECT} AND u.id = ?`).get(id)!));
  });

  r.get('/bookings', (c) => {
    const status = c.req.query('status') as BookingStatus | undefined;
    const rows =
      status && BOOKING_STATUSES.includes(status)
        ? db.prepare(`${BOOKING_SELECT} WHERE b.status = ? ORDER BY b.scheduled_at LIMIT 200`).all(status)
        : db.prepare(`${BOOKING_SELECT} ORDER BY b.created_at DESC LIMIT 200`).all();
    return c.json(rows.map((row) => rowToBooking(row)));
  });

  /** Approved drivers who can drive this car, with whether they're online or already busy at that time. */
  r.get('/bookings/:id/eligible-drivers', (c) => {
    const booking = findBooking(db, idParam(c));
    const drivers = db
      .prepare(`${DRIVER_SELECT} AND p.status = 'approved' ORDER BY p.is_online DESC, u.name`)
      .all()
      .filter((d) => canDrive(d.transmission, booking.car_transmission))
      .map((d) => ({ ...toAdminDriver(d), busy: clashes(d.id as number, booking).length > 0 }));
    return c.json(drivers);
  });

  r.post('/bookings/:id/assign', async (c) => {
    const { driverId } = await parseBody(c, z.object({ driverId: z.number().int().positive() }));
    const id = idParam(c);
    transaction(db, () => {
      const booking = findBooking(db, id);
      if (booking.status !== 'requested' && booking.status !== 'assigned') {
        throw conflict('Only requested or assigned bookings can be (re)assigned');
      }
      const driver = db.prepare(`SELECT * FROM driver_profiles WHERE user_id = ?`).get(driverId);
      if (!driver || driver.status !== 'approved') throw new HTTPException(400, { message: 'Driver is not approved' });
      if (!canDrive(driver.transmission, booking.car_transmission)) {
        throw new HTTPException(400, { message: `Driver cannot drive a ${booking.car_transmission} car` });
      }
      if (clashes(driverId, booking).length) throw conflict('Driver has another trip at this time');
      db.prepare(`UPDATE bookings SET driver_id = ?, status = 'assigned' WHERE id = ?`).run(driverId, id);
    });
    return c.json(rowToBooking(findBooking(db, id)));
  });

  r.post('/bookings/:id/cancel', async (c) => {
    const { reason } = await parseBody(c, z.object({ reason: z.string().trim().min(3).max(200) }));
    const id = idParam(c);
    const { changes } = db
      .prepare(
        `UPDATE bookings SET status = 'cancelled', cancel_reason = ?
         WHERE id = ? AND status IN ('requested', 'assigned')`,
      )
      .run(reason, id);
    if (!changes) throw conflict('Only requested or assigned bookings can be cancelled');
    return c.json(rowToBooking(findBooking(db, id)));
  });

  /** Drivers' share of customer-paid trips that hasn't been paid out yet, plus recent payouts. */
  r.get('/payouts', (c) => {
    const owed: DriverOwed[] = db
      .prepare(
        `SELECT u.id, u.name, u.phone,
           SUM(json_extract(b.fare_json, '$.driverEarning')) AS owed, COUNT(*) AS trips
         FROM bookings b JOIN users u ON u.id = b.driver_id
         WHERE b.payment_status = 'paid' AND b.payout_id IS NULL
         GROUP BY u.id ORDER BY owed DESC`,
      )
      .all()
      .map((row) => ({
        driverId: row.id as number,
        name: row.name as string,
        phone: (row.phone as string | null) ?? null,
        owed: row.owed as number,
        trips: row.trips as number,
      }));
    const payouts: Payout[] = db
      .prepare(
        `SELECT p.*, u.name AS driver_name FROM payouts p JOIN users u ON u.id = p.driver_id
         ORDER BY p.id DESC LIMIT 50`,
      )
      .all()
      .map((row) => ({
        id: row.id as number,
        driverId: row.driver_id as number,
        driverName: row.driver_name as string,
        amount: row.amount as number,
        bookingCount: row.booking_count as number,
        reference: row.reference as string,
        note: (row.note as string | null) ?? null,
        createdAt: row.created_at as string,
      }));
    return c.json({ owed, payouts });
  });

  /** Records that ops has paid a driver everything they are currently owed. */
  r.post('/payouts', async (c) => {
    const input = await parseBody(
      c,
      z.object({
        driverId: z.number().int().positive(),
        reference: z.string().trim().min(3).max(100),
        note: z.string().trim().max(300).optional(),
      }),
    );
    const payoutId = transaction(db, () => {
      const trips = db
        .prepare(
          `SELECT id, json_extract(fare_json, '$.driverEarning') AS earning FROM bookings
           WHERE driver_id = ? AND payment_status = 'paid' AND payout_id IS NULL`,
        )
        .all(input.driverId);
      if (!trips.length) throw conflict('Nothing is owed to this driver');
      const amount = trips.reduce((sum, t) => sum + (t.earning as number), 0);
      const { id } = db
        .prepare(
          `INSERT INTO payouts (driver_id, amount, booking_count, reference, note, created_by)
           VALUES (?, ?, ?, ?, ?, ?) RETURNING id`,
        )
        .get(input.driverId, amount, trips.length, input.reference, input.note || null, c.get('user').id)!;
      const mark = db.prepare('UPDATE bookings SET payout_id = ? WHERE id = ?');
      for (const t of trips) mark.run(id as number, t.id as number);
      return id as number;
    });
    return c.json({ id: payoutId }, 201);
  });

  r.get('/rate-card', (c) => c.json(getRateCard(db)));

  r.put('/rate-card', async (c) => {
    const card = await parseBody(c, rateCardInput);
    db.prepare(
      `UPDATE rate_card SET min_hours = ?, base_fare = ?, extra_hour_rate = ?, night_charge = ?,
         grace_minutes = ?, commission_pct = ? WHERE id = 1`,
    ).run(card.minHours, card.baseFare, card.extraHourRate, card.nightCharge, card.graceMinutes, card.commissionPct);
    return c.json(getRateCard(db));
  });

  return r;
}
