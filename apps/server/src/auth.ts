import { createHash, randomBytes } from 'node:crypto';
import type { Context, MiddlewareHandler } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { HTTPException } from 'hono/http-exception';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import type { AppName, Role, User } from '@chauffr/shared';
import type { DB } from './db.ts';
import type { Env } from './env.ts';

export type AppEnv = { Variables: { user: User } };

const SESSION_DAYS = 30;
const APPS: AppName[] = ['customer', 'driver', 'admin'];

export interface GoogleIdentity {
  sub: string;
  email: string;
  name: string;
}
export type GoogleVerifier = (credential: string) => Promise<GoogleIdentity>;

export function googleVerifier(clientId: string): GoogleVerifier {
  const jwks = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));
  return async (credential) => {
    if (!clientId) throw new HTTPException(500, { message: 'GOOGLE_CLIENT_ID is not configured' });
    const { payload } = await jwtVerify(credential, jwks, {
      issuer: ['accounts.google.com', 'https://accounts.google.com'],
      audience: clientId,
    }).catch(() => {
      throw new HTTPException(401, { message: 'Google sign-in failed' });
    });
    if (!payload.email_verified || typeof payload.email !== 'string') {
      throw new HTTPException(401, { message: 'Google account email is not verified' });
    }
    return {
      sub: payload.sub!,
      email: payload.email.toLowerCase(),
      name: typeof payload.name === 'string' ? payload.name : payload.email,
    };
  };
}

/**
 * Each app keeps its own session cookie, so a person can be signed in to the
 * customer and admin apps on the same host without the sessions clashing.
 */
export function appFrom(c: Context): AppName {
  const app = c.req.header('x-chauffr-app') as AppName | undefined;
  if (!app || !APPS.includes(app)) throw new HTTPException(400, { message: 'Missing X-Chauffr-App header' });
  return app;
}

const cookieName = (app: AppName) => `chauffr_${app}`;
const hash = (token: string) => createHash('sha256').update(token).digest('hex');

export function rowToUser(r: Record<string, unknown>): User {
  return {
    id: r.id as number,
    email: r.email as string,
    name: r.name as string,
    phone: (r.phone as string | null) ?? null,
    role: r.role as Role,
  };
}

/** Finds or creates the user for this app. Roles are fixed at sign-up. */
export function upsertUser(db: DB, env: Env, app: AppName, identity: Partial<GoogleIdentity> & { email: string; name: string }): User {
  const isAdminEmail = env.adminEmails.has(identity.email);
  const existing = db
    .prepare('SELECT * FROM users WHERE email = ? OR (google_sub IS NOT NULL AND google_sub = ?)')
    .get(identity.email, identity.sub ?? null);

  if (existing) {
    const user = rowToUser(existing);
    if (identity.sub && !existing.google_sub) {
      db.prepare('UPDATE users SET google_sub = ? WHERE id = ?').run(identity.sub, user.id);
    }
    if (user.role !== app) {
      throw new HTTPException(403, { message: `This account is registered as a ${user.role}. Use the ${user.role} app.` });
    }
    return user;
  }

  if (app === 'admin' && !isAdminEmail) {
    throw new HTTPException(403, { message: 'This account is not an admin' });
  }
  if (app !== 'admin' && isAdminEmail) {
    throw new HTTPException(403, { message: 'Admin accounts can only use the admin dashboard' });
  }
  const row = db
    .prepare('INSERT INTO users (email, google_sub, name, role) VALUES (?, ?, ?, ?) RETURNING *')
    .get(identity.email, identity.sub ?? null, identity.name, app)!;
  return rowToUser(row);
}

export function startSession(c: Context, db: DB, env: Env, app: AppName, userId: number) {
  const token = randomBytes(32).toString('base64url');
  const expires = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  db.prepare('INSERT INTO sessions VALUES (?, ?, ?)').run(hash(token), userId, expires.toISOString());
  setCookie(c, cookieName(app), token, {
    httpOnly: true,
    secure: env.cookieSecure,
    sameSite: 'Lax',
    path: '/',
    expires,
  });
}

export function endSession(c: Context, db: DB, app: AppName) {
  const token = getCookie(c, cookieName(app));
  if (token) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(hash(token));
  deleteCookie(c, cookieName(app), { path: '/' });
}

export function requireUser(db: DB, roles?: Role[]): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const token = getCookie(c, cookieName(appFrom(c)));
    const row = token
      ? db
          .prepare(
            `SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
             WHERE s.token_hash = ? AND s.expires_at > ?`,
          )
          .get(hash(token), new Date().toISOString())
      : undefined;
    if (!row) throw new HTTPException(401, { message: 'Please sign in' });
    const user = rowToUser(row);
    if (roles && !roles.includes(user.role)) throw new HTTPException(403, { message: 'Not allowed' });
    c.set('user', user);
    await next();
  };
}
