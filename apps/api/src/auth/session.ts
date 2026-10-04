import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { Context, MiddlewareHandler } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import type { AuthProvider } from '@quest/shared';
import type { Db } from '../db/db.ts';
import { HttpError, type AppEnv, type AuthedUser, type Deps } from '../http.ts';
import { paths, type ApiKeyDoc, type IdentityDoc, type SessionDoc, type UserDoc } from '../models.ts';

export const SESSION_COOKIE = 'qq_session';
const SESSION_DAYS = 30;

export const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');
export const randomToken = (bytes = 32) => randomBytes(bytes).toString('base64url');

export interface ProviderProfile {
  provider: AuthProvider | 'dev';
  providerId: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl: string;
}

/** Finds or creates the user for a provider identity. Emails in ADMIN_EMAILS are made admin. */
export async function upsertUser(deps: Deps, profile: ProviderProfile): Promise<string> {
  const { db, config } = deps;
  const identityPath = paths.identity(profile.provider, profile.providerId);
  const isAdminEmail = config.adminEmails.includes(profile.email.toLowerCase());
  return db.transaction(async (tx) => {
    const identity = await tx.get<IdentityDoc>(identityPath);
    if (identity) {
      if (isAdminEmail) tx.merge(paths.user(identity.uid), { role: 'admin' });
      return identity.uid;
    }
    const uid = randomUUID();
    const displayName = `${profile.firstName} ${profile.lastName}`.trim() || profile.email.split('@')[0] || 'Traveler';
    const user: UserDoc = {
      displayName,
      displayNameLower: displayName.toLowerCase(),
      firstName: profile.firstName,
      lastName: profile.lastName,
      email: profile.email,
      emailLower: profile.email.toLowerCase(),
      avatarUrl: profile.avatarUrl,
      bio: '',
      role: isAdminEmail ? 'admin' : 'player',
      banned: false,
      provider: profile.provider,
      apiKeyHash: null,
      apiKeyPrefix: null,
      activeLevelId: null,
      totalScore: 0,
      createdAt: deps.now().toISOString(),
    };
    tx.set(identityPath, { uid } satisfies IdentityDoc);
    tx.set(paths.user(uid), user);
    return uid;
  });
}

export async function startSession(c: Context<AppEnv>, uid: string): Promise<void> {
  const { db, config, now } = c.get('deps');
  const token = randomToken();
  const expiresAt = new Date(now().getTime() + SESSION_DAYS * 86_400_000);
  await db.set(paths.session(sha256(token)), { uid, expiresAt: expiresAt.toISOString() } satisfies SessionDoc);
  setCookie(c, SESSION_COOKIE, token, {
    httpOnly: true,
    secure: config.production,
    sameSite: 'Lax',
    path: '/',
    expires: expiresAt,
  });
}

export async function endSession(c: Context<AppEnv>): Promise<void> {
  const token = getCookie(c, SESSION_COOKIE);
  if (token) await c.get('deps').db.delete(paths.session(sha256(token)));
  deleteCookie(c, SESSION_COOKIE, { path: '/' });
}

/**
 * Resolves the caller from `Authorization: ApiKey <key>` or the session cookie.
 * Sets `user` to null when anonymous. Banned users are rejected by requireUser.
 */
export const identify: MiddlewareHandler<AppEnv> = async (c, next) => {
  const { db, now } = c.get('deps');
  let uid: string | null = null;
  const header = c.req.header('Authorization');
  if (header) {
    const match = /^ApiKey\s+(\S+)$/i.exec(header);
    if (!match) throw new HttpError(401, 'invalid_authorization', 'Use the header "Authorization: ApiKey <your key>"');
    const key = await db.get<ApiKeyDoc>(paths.apiKey(sha256(match[1]!)));
    if (!key) throw new HttpError(401, 'invalid_api_key', 'Unknown or revoked API key');
    uid = key.uid;
  } else {
    const token = getCookie(c, SESSION_COOKIE);
    if (token) {
      const session = await db.get<SessionDoc>(paths.session(sha256(token)));
      if (session && session.expiresAt > now().toISOString()) uid = session.uid;
    }
  }
  c.set('user', uid ? await loadUser(db, uid) : null);
  await next();
};

async function loadUser(db: Db, uid: string): Promise<AuthedUser | null> {
  const doc = await db.get<UserDoc>(paths.user(uid));
  return doc ? { id: uid, doc } : null;
}

export function requireUser(c: Context<AppEnv>): AuthedUser {
  const user = c.get('user');
  if (!user) throw new HttpError(401, 'unauthenticated', 'Log in, or pass "Authorization: ApiKey <your key>"');
  if (user.doc.banned) throw new HttpError(403, 'banned', 'This account is suspended');
  return user;
}

export const requireAdmin: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (requireUser(c).doc.role !== 'admin') throw new HttpError(403, 'forbidden', 'Admin only');
  await next();
};
