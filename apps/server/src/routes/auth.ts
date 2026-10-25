import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import { profileInput } from '@chauffr/shared';
import { appFrom, endSession, requireUser, rowToUser, startSession, upsertUser, type AppEnv, type GoogleVerifier } from '../auth.ts';
import type { DB } from '../db.ts';
import type { Env } from '../env.ts';
import { parseBody } from '../model.ts';

export function authRoutes(db: DB, env: Env, verifyGoogle: GoogleVerifier) {
  const r = new Hono<AppEnv>();

  r.get('/config', (c) => c.json({ googleClientId: env.googleClientId, devLogin: env.devLogin }));

  r.post('/google', async (c) => {
    const app = appFrom(c);
    const { credential } = await parseBody(c, z.object({ credential: z.string().min(1) }));
    const user = upsertUser(db, env, app, await verifyGoogle(credential));
    startSession(c, db, env, app, user.id);
    return c.json(user);
  });

  r.post('/dev', async (c) => {
    if (!env.devLogin) throw new HTTPException(404, { message: 'Not found' });
    const app = appFrom(c);
    const { email } = await parseBody(c, z.object({ email: z.email().toLowerCase() }));
    const user = upsertUser(db, env, app, { email, name: email.split('@')[0]! });
    startSession(c, db, env, app, user.id);
    return c.json(user);
  });

  r.post('/logout', (c) => {
    endSession(c, db, appFrom(c));
    return c.json({ ok: true });
  });

  r.get('/me', requireUser(db), (c) => c.json(c.get('user')));

  r.patch('/me', requireUser(db), async (c) => {
    const input = await parseBody(c, profileInput);
    const row = db
      .prepare('UPDATE users SET name = ?, phone = ? WHERE id = ? RETURNING *')
      .get(input.name, input.phone, c.get('user').id)!;
    return c.json(rowToUser(row));
  });

  return r;
}
