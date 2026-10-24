import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import type { PublicRateCard } from '@chauffr/shared';
import { db } from '../db';
import { rateCards } from '../db/schema';

export async function pricingRoutes(app: FastifyInstance) {
  app.get('/rate-card', async (): Promise<{ rateCard: PublicRateCard | null }> => ({
    rateCard:
      db
        .select({
          baseFare: rateCards.baseFare,
          baseMinutes: rateCards.baseMinutes,
          extraPer30Min: rateCards.extraPer30Min,
          nightCharge: rateCards.nightCharge,
          nightStartHour: rateCards.nightStartHour,
          nightEndHour: rateCards.nightEndHour,
        })
        .from(rateCards)
        .where(eq(rateCards.active, true))
        .get() ?? null,
  }));
}
