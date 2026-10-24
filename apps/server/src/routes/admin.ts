import type { FastifyInstance } from 'fastify';
import { desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { DRIVER_STATUSES } from '@chauffr/shared';
import { requireRole } from '../auth';
import { db } from '../db';
import { drivers, rateCards, users } from '../db/schema';
import { httpError } from '../errors';
import { driverProfileColumns } from './driver';

export async function adminRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireRole('admin'));

  app.get('/drivers', async (req) => {
    const { status } = z.object({ status: z.enum(DRIVER_STATUSES).optional() }).parse(req.query);
    const query = db
      .select({ ...driverProfileColumns, name: users.name, email: users.email, phone: users.phone })
      .from(drivers)
      .innerJoin(users, eq(drivers.userId, users.id))
      .orderBy(desc(drivers.createdAt));
    return { drivers: (status ? query.where(eq(drivers.status, status)) : query).all() };
  });

  app.post('/drivers/:id/status', async (req) => {
    const { id } = z.object({ id: z.coerce.number().int() }).parse(req.params);
    const body = z
      .object({ status: z.enum(['approved', 'rejected', 'suspended']), reason: z.string().trim().max(500).optional() })
      .parse(req.body);
    const driver = db.select().from(drivers).where(eq(drivers.userId, id)).get();
    if (!driver) throw httpError(404, 'Driver not found');
    if (body.status === 'approved' && !driver.licenceNumber) {
      throw httpError(400, 'Driver has not submitted their details yet');
    }
    if (body.status !== 'approved' && !body.reason) throw httpError(400, 'Give a reason');

    db.update(drivers)
      .set({
        status: body.status,
        rejectionReason: body.status === 'approved' ? null : body.reason,
        reviewedAt: new Date(),
        reviewedBy: req.user!.id,
        // Only approved drivers may stay online.
        ...(body.status !== 'approved' && { isOnline: false }),
      })
      .where(eq(drivers.userId, id))
      .run();
    return { ok: true };
  });

  app.get('/rate-card', async () => ({
    rateCard: db.select().from(rateCards).where(eq(rateCards.active, true)).get() ?? null,
  }));
}
