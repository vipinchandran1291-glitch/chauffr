import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import { driverProfileInput, finalFare, type RateCard } from '@chauffr/shared';
import { requireUser, type AppEnv } from '../auth.ts';
import type { DB } from '../db.ts';
import { BOOKING_SELECT, conflict, findBooking, idParam, notFound, parseBody, rowToBooking, rowToDriverProfile } from '../model.ts';

export function driverRoutes(db: DB) {
  const r = new Hono<AppEnv>();
  r.use(requireUser(db, ['driver']));

  const getProfile = (userId: number) => {
    const row = db.prepare('SELECT * FROM driver_profiles WHERE user_id = ?').get(userId);
    return row ? rowToDriverProfile(row) : null;
  };

  const ownBooking = (c: { get(k: 'user'): { id: number } }, id: number) => {
    const row = findBooking(db, id);
    if (row.driver_id !== c.get('user').id) throw notFound('Booking');
    return row;
  };

  r.get('/profile', (c) => c.json(getProfile(c.get('user').id)));

  // Approved drivers can't edit their own documents; ops re-verifies changes.
  r.put('/profile', async (c) => {
    const userId = c.get('user').id;
    const existing = getProfile(userId);
    if (existing && existing.status !== 'pending' && existing.status !== 'rejected') {
      throw conflict('Contact support to change verified details');
    }
    const input = await parseBody(c, driverProfileInput);
    db.prepare(
      `INSERT INTO driver_profiles (user_id, license_number, license_expiry, transmission, status)
       VALUES (?, ?, ?, ?, 'pending')
       ON CONFLICT (user_id) DO UPDATE SET
         license_number = excluded.license_number,
         license_expiry = excluded.license_expiry,
         transmission = excluded.transmission,
         status = 'pending',
         updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`,
    ).run(userId, input.licenseNumber, input.licenseExpiry, input.transmission);
    return c.json(getProfile(userId));
  });

  r.post('/online', async (c) => {
    const { online } = await parseBody(c, z.object({ online: z.boolean() }));
    const userId = c.get('user').id;
    if (online && getProfile(userId)?.status !== 'approved') {
      throw new HTTPException(403, { message: 'You can go online once your profile is approved' });
    }
    db.prepare('UPDATE driver_profiles SET is_online = ? WHERE user_id = ?').run(online ? 1 : 0, userId);
    return c.json(getProfile(userId));
  });

  r.get('/bookings', (c) => {
    const rows = db
      .prepare(
        `${BOOKING_SELECT} WHERE b.driver_id = ?
         ORDER BY CASE WHEN b.status IN ('assigned', 'in_progress') THEN 0 ELSE 1 END, b.scheduled_at DESC
         LIMIT 50`,
      )
      .all(c.get('user').id);
    return c.json(rows.map((row) => rowToBooking(row)));
  });

  r.post('/bookings/:id/start', async (c) => {
    const { otp } = await parseBody(c, z.object({ otp: z.string().regex(/^\d{4}$/, 'Enter the 4-digit code') }));
    const id = idParam(c);
    const row = ownBooking(c, id);
    if (row.status !== 'assigned') throw conflict('This trip cannot be started');
    if (row.start_otp !== otp) throw new HTTPException(400, { message: 'Incorrect start code' });
    db.prepare(`UPDATE bookings SET status = 'in_progress', started_at = ? WHERE id = ?`).run(new Date().toISOString(), id);
    return c.json(rowToBooking(findBooking(db, id)));
  });

  r.post('/bookings/:id/end', (c) => {
    const id = idParam(c);
    const row = ownBooking(c, id);
    if (row.status !== 'in_progress') throw conflict('This trip is not in progress');
    const endedAt = new Date();
    const fare = finalFare(JSON.parse(row.rate_card_json as string) as RateCard, new Date(row.started_at as string), endedAt);
    db.prepare(`UPDATE bookings SET status = 'completed', ended_at = ?, fare_json = ? WHERE id = ?`).run(
      endedAt.toISOString(),
      JSON.stringify(fare),
      id,
    );
    return c.json(rowToBooking(findBooking(db, id)));
  });

  return r;
}
