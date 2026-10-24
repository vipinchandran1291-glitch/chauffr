import cookie from '@fastify/cookie';
import Fastify, { type FastifyError } from 'fastify';
import { ZodError } from 'zod';
import { registerAuth } from './auth';
import { runMigrations } from './db';
import { ensureDefaultRateCard } from './db/seed';
import { env } from './env';
import { adminRoutes } from './routes/admin';
import { authRoutes } from './routes/auth';
import { carRoutes } from './routes/cars';
import { driverRoutes } from './routes/driver';

export async function buildApp() {
  runMigrations();
  ensureDefaultRateCard();

  const app = Fastify({
    logger: process.env.NODE_ENV === 'test' ? false : { level: env.isProd ? 'info' : 'debug' },
    trustProxy: true, // behind Nginx
  });

  await app.register(cookie);
  registerAuth(app);

  app.setErrorHandler((err: FastifyError, req, reply) => {
    if (err instanceof ZodError) {
      const message = err.issues.map((i) => (i.path.length ? `${i.path.join('.')}: ${i.message}` : i.message));
      return reply.code(400).send({ message: message.join('; ') });
    }
    if (err.statusCode && err.statusCode < 500) return reply.code(err.statusCode).send({ message: err.message });
    req.log.error(err);
    return reply.code(500).send({ message: 'Something went wrong' });
  });

  app.get('/api/health', async () => ({ ok: true }));
  await app.register(authRoutes, { prefix: '/api' });
  await app.register(carRoutes, { prefix: '/api/cars' });
  await app.register(driverRoutes, { prefix: '/api/driver' });
  await app.register(adminRoutes, { prefix: '/api/admin' });

  return app;
}
