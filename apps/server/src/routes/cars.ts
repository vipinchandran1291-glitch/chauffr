import type { FastifyInstance } from 'fastify';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { CAR_TYPES, isValidRegNumber, normalizeRegNumber, TRANSMISSIONS } from '@chauffr/shared';
import { requireRole } from '../auth';
import { db } from '../db';
import { cars } from '../db/schema';
import { httpError } from '../errors';

const carInput = z.object({
  make: z.string().trim().min(1).max(40),
  model: z.string().trim().min(1).max(40),
  regNumber: z
    .string()
    .transform(normalizeRegNumber)
    .refine(isValidRegNumber, 'Enter a valid registration number, e.g. KA01AB1234'),
  transmission: z.enum(TRANSMISSIONS),
  carType: z.enum(CAR_TYPES),
});

const publicColumns = {
  id: cars.id,
  make: cars.make,
  model: cars.model,
  regNumber: cars.regNumber,
  transmission: cars.transmission,
  carType: cars.carType,
  createdAt: cars.createdAt,
};

export async function carRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireRole('customer'));

  app.get('/', async (req) => ({
    cars: db
      .select(publicColumns)
      .from(cars)
      .where(and(eq(cars.ownerId, req.user!.id), isNull(cars.deletedAt)))
      .orderBy(desc(cars.createdAt))
      .all(),
  }));

  app.post('/', async (req, reply) => {
    const input = carInput.parse(req.body);
    const car = db
      .insert(cars)
      .values({ ...input, ownerId: req.user!.id })
      .returning(publicColumns)
      .get();
    return reply.code(201).send({ car });
  });

  // Soft delete: past bookings still point at the car.
  app.delete('/:id', async (req) => {
    const { id } = z.object({ id: z.coerce.number().int() }).parse(req.params);
    const result = db
      .update(cars)
      .set({ deletedAt: new Date() })
      .where(and(eq(cars.id, id), eq(cars.ownerId, req.user!.id), isNull(cars.deletedAt)))
      .run();
    if (result.changes === 0) throw httpError(404, 'Car not found');
    return { ok: true };
  });
}
