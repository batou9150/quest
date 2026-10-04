import { decodeIdToken, generateCodeVerifier, generateState, GitHub, Google } from 'arctic';
import { Hono, type Context } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { z } from 'zod';
import type { AuthProviders } from '@quest/shared';
import { endSession, startSession, upsertUser, type ProviderProfile } from '../auth/session.ts';
import { body, HttpError, log, type AppEnv } from '../http.ts';

const STATE_COOKIE = 'qq_oauth_state';
const VERIFIER_COOKIE = 'qq_oauth_verifier';
const AFTER_LOGIN = '/level-select';

/** /auth/*: OAuth login with Google or GitHub, dev login, logout. */
export const auth = new Hono<AppEnv>();

auth.get('/providers', (c) => {
  const { config } = c.get('deps');
  return c.json<AuthProviders>({ google: !!config.google, github: !!config.github, dev: config.devLogin });
});

auth.get('/google', (c) => {
  const google = googleClient(c);
  const state = generateState();
  const verifier = generateCodeVerifier();
  rememberOAuth(c, state, verifier);
  return c.redirect(google.createAuthorizationURL(state, verifier, ['openid', 'profile', 'email']).toString());
});

auth.get('/google/callback', async (c) => {
  const { code, verifier } = checkOAuthCallback(c);
  if (!verifier) throw new HttpError(400, 'invalid_oauth_state', 'Login expired. Please try again.');
  const tokens = await googleClient(c).validateAuthorizationCode(code, verifier);
  // The ID token comes straight from Google's token endpoint over TLS, so decoding without verifying is safe.
  const claims = decodeIdToken(tokens.idToken()) as Record<string, string | boolean | undefined>;
  if (!claims.email || claims.email_verified === false) throw new HttpError(400, 'email_unverified', 'Your Google email is not verified');
  return finishLogin(c, {
    provider: 'google',
    providerId: String(claims.sub),
    email: String(claims.email),
    firstName: String(claims.given_name ?? ''),
    lastName: String(claims.family_name ?? ''),
    avatarUrl: String(claims.picture ?? ''),
  });
});

auth.get('/github', (c) => {
  const state = generateState();
  rememberOAuth(c, state);
  return c.redirect(githubClient(c).createAuthorizationURL(state, ['read:user', 'user:email']).toString());
});

auth.get('/github/callback', async (c) => {
  const { code } = checkOAuthCallback(c);
  const tokens = await githubClient(c).validateAuthorizationCode(code);
  const headers = { Authorization: `Bearer ${tokens.accessToken()}`, 'User-Agent': 'quantum-quest' };
  const user = (await (await fetch('https://api.github.com/user', { headers })).json()) as {
    id: number;
    login: string;
    name: string | null;
    avatar_url: string;
  };
  const emails = (await (await fetch('https://api.github.com/user/emails', { headers })).json()) as Array<{
    email: string;
    primary: boolean;
    verified: boolean;
  }>;
  const email = emails.find((e) => e.primary && e.verified)?.email;
  if (!email) throw new HttpError(400, 'email_unverified', 'Your GitHub account has no verified primary email');
  const [firstName = user.login, ...rest] = (user.name ?? user.login).split(' ');
  return finishLogin(c, {
    provider: 'github',
    providerId: String(user.id),
    email,
    firstName,
    lastName: rest.join(' '),
    avatarUrl: user.avatar_url,
  });
});

/** Local development only: log in as any name, no OAuth app needed. */
auth.post('/dev', async (c) => {
  if (!c.get('deps').config.devLogin) throw new HttpError(404, 'not_found', 'Not found');
  const { name } = await body(c, z.object({ name: z.string().trim().min(1).max(40) }));
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'dev';
  const [firstName = name, ...rest] = name.split(' ');
  const uid = await upsertUser(c.get('deps'), {
    provider: 'dev',
    providerId: slug,
    email: `${slug}@dev.local`,
    firstName,
    lastName: rest.join(' '),
    avatarUrl: `https://api.dicebear.com/9.x/identicon/svg?seed=${encodeURIComponent(slug)}`,
  });
  await startSession(c, uid);
  return c.body(null, 204);
});

auth.post('/logout', async (c) => {
  await endSession(c);
  return c.body(null, 204);
});

async function finishLogin(c: Context<AppEnv>, profile: ProviderProfile) {
  const uid = await upsertUser(c.get('deps'), profile);
  await startSession(c, uid);
  log('INFO', 'login', { uid, provider: profile.provider });
  return c.redirect(AFTER_LOGIN);
}

function googleClient(c: Context<AppEnv>): Google {
  const { config } = c.get('deps');
  if (!config.google) throw new HttpError(404, 'provider_disabled', 'Google login is not configured');
  return new Google(config.google.clientId, config.google.clientSecret, `${config.publicUrl}/auth/google/callback`);
}

function githubClient(c: Context<AppEnv>): GitHub {
  const { config } = c.get('deps');
  if (!config.github) throw new HttpError(404, 'provider_disabled', 'GitHub login is not configured');
  return new GitHub(config.github.clientId, config.github.clientSecret, `${config.publicUrl}/auth/github/callback`);
}

function rememberOAuth(c: Context<AppEnv>, state: string, verifier?: string) {
  const options = { httpOnly: true, secure: c.get('deps').config.production, sameSite: 'Lax', path: '/auth', maxAge: 600 } as const;
  setCookie(c, STATE_COOKIE, state, options);
  if (verifier) setCookie(c, VERIFIER_COOKIE, verifier, options);
}

function checkOAuthCallback(c: Context<AppEnv>) {
  const code = c.req.query('code');
  const state = c.req.query('state');
  const expected = getCookie(c, STATE_COOKIE);
  const verifier = getCookie(c, VERIFIER_COOKIE);
  deleteCookie(c, STATE_COOKIE, { path: '/auth' });
  deleteCookie(c, VERIFIER_COOKIE, { path: '/auth' });
  if (!code || !state || state !== expected) {
    throw new HttpError(400, 'invalid_oauth_state', 'Login expired or was tampered with. Please try again.');
  }
  return { code, verifier };
}
