import { createHash, randomBytes } from 'node:crypto';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { and, eq, gt } from 'drizzle-orm';
import type { Me, Role } from '@chauffr/shared';
import { db } from './db';
import { sessions, users } from './db/schema';
import { env } from './env';
import { httpError } from './errors';

export type User = typeof users.$inferSelect;

declare module 'fastify' {
  interface FastifyRequest {
    user: User | null;
  }
}

const COOKIE = 'chauffr_sid';
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

// Only a hash of the token is stored, so a leaked database can't be used to hijack sessions.
const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

export function createSession(reply: FastifyReply, userId: number): void {
  const token = randomBytes(32).toString('base64url');
  db.insert(sessions)
    .values({ tokenHash: hashToken(token), userId, expiresAt: new Date(Date.now() + SESSION_TTL_MS) })
    .run();
  reply.setCookie(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.isProd,
    path: '/',
    maxAge: SESSION_TTL_MS / 1000,
  });
}

export function destroySession(req: FastifyRequest, reply: FastifyReply): void {
  const token = req.cookies[COOKIE];
  if (token) db.delete(sessions).where(eq(sessions.tokenHash, hashToken(token))).run();
  reply.clearCookie(COOKIE, { path: '/' });
}

export function registerAuth(app: FastifyInstance): void {
  app.decorateRequest('user', null);
  app.addHook('onRequest', async (req) => {
    const token = req.cookies[COOKIE];
    if (!token) return;
    const row = db
      .select({ user: users })
      .from(sessions)
      .innerJoin(users, eq(sessions.userId, users.id))
      .where(and(eq(sessions.tokenHash, hashToken(token)), gt(sessions.expiresAt, new Date())))
      .get();
    req.user = row?.user ?? null;
  });
}

/** preHandler that requires a signed-in user, optionally with one of the given roles. */
export function requireRole(...roles: Role[]) {
  return async (req: FastifyRequest) => {
    if (!req.user) throw httpError(401, 'Please sign in');
    if (roles.length > 0 && !roles.includes(req.user.role)) throw httpError(403, 'Not allowed');
  };
}

export function toMe(user: User): Me {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl,
    phone: user.phone,
    phoneVerified: user.phoneVerified,
    role: user.role,
  };
}
