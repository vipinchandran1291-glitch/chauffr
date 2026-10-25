import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { AppEnv, GoogleVerifier } from './auth.ts';
import type { DB } from './db.ts';
import type { Env } from './env.ts';
import { adminRoutes } from './routes/admin.ts';
import { authRoutes } from './routes/auth.ts';
import { customerRoutes } from './routes/customer.ts';
import { driverRoutes } from './routes/driver.ts';

export function createApp(db: DB, env: Env, verifyGoogle: GoogleVerifier) {
  const app = new Hono<AppEnv>().basePath('/api');

  app.get('/health', (c) => c.json({ ok: true }));
  app.route('/auth', authRoutes(db, env, verifyGoogle));
  app.route('/customer', customerRoutes(db));
  app.route('/driver', driverRoutes(db));
  app.route('/admin', adminRoutes(db));

  app.notFound((c) => c.json({ error: 'Not found' }, 404));
  app.onError((err, c) => {
    if (err instanceof HTTPException) return c.json({ error: err.message }, err.status);
    console.error(err);
    return c.json({ error: 'Something went wrong' }, 500);
  });

  return app;
}
