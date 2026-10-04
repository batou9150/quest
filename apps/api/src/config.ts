import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const list = z
  .string()
  .default('')
  .transform((s) => s.split(',').map((x) => x.trim().toLowerCase()).filter(Boolean));
const flag = z.enum(['true', 'false', '']).default('false').transform((v) => v === 'true');

const EnvSchema = z.object({
  NODE_ENV: z.string().default('development'),
  PORT: z.coerce.number().int().default(8080),
  /** Public origin of the site, used for OAuth callbacks and CSRF checks. */
  PUBLIC_URL: z.url().default('http://localhost:5173'),
  STORE: z.enum(['firestore', 'memory']).default('firestore'),
  /** Adds the demo level and starter guides at startup when missing (default: on with the memory store). */
  SEED_DEMO: z.enum(['true', 'false']).optional(),
  /** Emails that get the admin role at login. Used to bootstrap the first admin. */
  ADMIN_EMAILS: list,
  DEV_LOGIN: flag,
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GITHUB_CLIENT_ID: z.string().optional(),
  GITHUB_CLIENT_SECRET: z.string().optional(),
  /** Game API calls per user per minute. */
  GAME_RATE_LIMIT: z.coerce.number().int().positive().default(60),
  WEB_DIST: z.string().default(fileURLToPath(new URL('../../web/dist', import.meta.url))),
  GUIDES_DIR: z.string().default(fileURLToPath(new URL('../../../content/guides', import.meta.url))),
});

export type Config = ReturnType<typeof loadConfig>;

export function loadConfig(env: Record<string, string | undefined> = process.env) {
  const e = EnvSchema.parse(env);
  const production = e.NODE_ENV === 'production';
  if (production && e.DEV_LOGIN) throw new Error('DEV_LOGIN must not be enabled in production');
  return {
    production,
    port: e.PORT,
    publicUrl: e.PUBLIC_URL.replace(/\/$/, ''),
    store: e.STORE,
    seedDemo: e.SEED_DEMO ? e.SEED_DEMO === 'true' : e.STORE === 'memory',
    adminEmails: e.ADMIN_EMAILS,
    devLogin: e.DEV_LOGIN,
    google: e.GOOGLE_CLIENT_ID && e.GOOGLE_CLIENT_SECRET ? { clientId: e.GOOGLE_CLIENT_ID, clientSecret: e.GOOGLE_CLIENT_SECRET } : null,
    github: e.GITHUB_CLIENT_ID && e.GITHUB_CLIENT_SECRET ? { clientId: e.GITHUB_CLIENT_ID, clientSecret: e.GITHUB_CLIENT_SECRET } : null,
    gameRateLimit: e.GAME_RATE_LIMIT,
    webDist: e.WEB_DIST,
    guidesDir: e.GUIDES_DIR,
  };
}
