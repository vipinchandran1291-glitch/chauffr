import type { FastifyInstance } from 'fastify';
import { eq, or } from 'drizzle-orm';
import { OAuth2Client } from 'google-auth-library';
import { z } from 'zod';
import { normalizeIndianPhone, ROLES, type AppName, type PublicConfig } from '@chauffr/shared';
import { createSession, destroySession, requireRole, toMe, type User } from '../auth';
import { db } from '../db';
import { drivers, users } from '../db/schema';
import { env } from '../env';
import { httpError } from '../errors';

const googleClient = new OAuth2Client();
const appName = z.enum(ROLES);

interface Identity {
  email: string;
  name: string;
  avatarUrl: string | null;
  googleSub: string | null;
}

// One Google account has one role, so someone who is both a customer and a driver uses two accounts.
function signIn(app: AppName, identity: Identity): User {
  const email = identity.email.toLowerCase();
  const isAdminEmail = env.adminEmails.includes(email);
  if (app === 'admin' && !isAdminEmail) throw httpError(403, 'This account is not an admin');

  return db.transaction((tx) => {
    const existing = tx
      .select()
      .from(users)
      .where(
        identity.googleSub
          ? or(eq(users.googleSub, identity.googleSub), eq(users.email, email))
          : eq(users.email, email),
      )
      .get();

    if (!existing) {
      const user = tx
        .insert(users)
        .values({ email, name: identity.name, avatarUrl: identity.avatarUrl, googleSub: identity.googleSub, role: app })
        .returning()
        .get();
      if (app === 'driver') tx.insert(drivers).values({ userId: user.id }).run();
      return user;
    }

    if (existing.role !== app && app !== 'admin') {
      throw httpError(
        403,
        `This Google account is registered as a ${existing.role}. Use a different account for the ${app} app.`,
      );
    }
    return tx
      .update(users)
      .set({
        role: app,
        googleSub: existing.googleSub ?? identity.googleSub,
        name: existing.name || identity.name,
        avatarUrl: identity.avatarUrl ?? existing.avatarUrl,
      })
      .where(eq(users.id, existing.id))
      .returning()
      .get();
  });
}

export async function authRoutes(app: FastifyInstance) {
  app.get('/config', async (): Promise<PublicConfig> => ({
    googleClientId: env.googleClientId,
    devLogin: env.devLogin,
  }));

  app.post('/auth/google', async (req, reply) => {
    const body = z.object({ credential: z.string().min(1), app: appName }).parse(req.body);
    if (!env.googleClientId) throw httpError(503, 'Google sign-in is not configured');
    const payload = await googleClient
      .verifyIdToken({ idToken: body.credential, audience: env.googleClientId })
      .then((ticket) => ticket.getPayload())
      .catch(() => undefined);
    if (!payload?.email || !payload.email_verified) throw httpError(401, 'Google sign-in failed');

    const user = signIn(body.app, {
      email: payload.email,
      name: payload.name ?? '',
      avatarUrl: payload.picture ?? null,
      googleSub: payload.sub,
    });
    createSession(reply, user.id);
    return { user: toMe(user) };
  });

  if (env.devLogin) {
    app.post('/auth/dev', async (req, reply) => {
      const body = z.object({ email: z.string().email(), app: appName }).parse(req.body);
      const user = signIn(body.app, {
        email: body.email,
        name: body.email.split('@')[0] ?? '',
        avatarUrl: null,
        googleSub: null,
      });
      createSession(reply, user.id);
      return { user: toMe(user) };
    });
  }

  app.post('/auth/logout', async (req, reply) => {
    destroySession(req, reply);
    return { ok: true };
  });

  app.get('/me', async (req) => ({ user: req.user ? toMe(req.user) : null }));

  app.patch('/me', { preHandler: requireRole() }, async (req) => {
    const body = z
      .object({ name: z.string().trim().min(1).max(80).optional(), phone: z.string().optional() })
      .parse(req.body);
    const user = req.user!;
    const changes: Partial<User> = {};
    if (body.name !== undefined) changes.name = body.name;
    if (body.phone !== undefined) {
      const phone = normalizeIndianPhone(body.phone);
      if (!phone) throw httpError(400, 'Enter a valid 10-digit Indian mobile number');
      if (phone !== user.phone) Object.assign(changes, { phone, phoneVerified: false });
    }
    if (Object.keys(changes).length === 0) return { user: toMe(user) };
    const updated = db.update(users).set(changes).where(eq(users.id, user.id)).returning().get();
    return { user: toMe(updated) };
  });
}
