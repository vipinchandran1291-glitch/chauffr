import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { CAR_TYPES } from '@chauffr/shared';
import { requireRole } from '../auth';
import { db } from '../db';
import { drivers } from '../db/schema';
import { httpError } from '../errors';

export const driverProfileColumns = {
  userId: drivers.userId,
  status: drivers.status,
  licenceNumber: drivers.licenceNumber,
  licenceExpiry: drivers.licenceExpiry,
  canManual: drivers.canManual,
  canAutomatic: drivers.canAutomatic,
  carTypes: drivers.carTypes,
  rejectionReason: drivers.rejectionReason,
  reviewedAt: drivers.reviewedAt,
  createdAt: drivers.createdAt,
};

const profileInput = z
  .object({
    licenceNumber: z
      .string()
      .transform((s) => s.toUpperCase().replace(/[\s-]/g, ''))
      .refine((s) => /^[A-Z0-9]{10,20}$/.test(s), 'Enter your driving licence number as printed'),
    licenceExpiry: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .refine((d) => new Date(d) > new Date(), 'Licence has expired'),
    canManual: z.boolean(),
    canAutomatic: z.boolean(),
    carTypes: z.array(z.enum(CAR_TYPES)).min(1, 'Pick at least one car type'),
  })
  .refine((p) => p.canManual || p.canAutomatic, 'Pick at least one transmission');

function getProfile(userId: number) {
  const profile = db.select(driverProfileColumns).from(drivers).where(eq(drivers.userId, userId)).get();
  if (!profile) throw httpError(404, 'Driver profile not found');
  return profile;
}

export async function driverRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireRole('driver'));

  app.get('/profile', async (req) => ({ profile: getProfile(req.user!.id) }));

  // Submitting (or resubmitting after rejection) puts the driver back in the review queue.
  app.put('/profile', async (req) => {
    const input = profileInput.parse(req.body);
    const current = getProfile(req.user!.id);
    if (current.status === 'approved' || current.status === 'suspended') {
      throw httpError(409, 'Contact support to change your details');
    }
    if (!req.user!.phone) throw httpError(400, 'Add your mobile number first');
    db.update(drivers)
      .set({ ...input, status: 'pending', rejectionReason: null })
      .where(eq(drivers.userId, req.user!.id))
      .run();
    return { profile: getProfile(req.user!.id) };
  });
}
