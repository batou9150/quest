import type { Context, Env } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { DEFAULT_LANG, isLang, type Lang } from '@quest/shared';
import { z } from 'zod';
import type { Config } from './config.ts';
import type { Db } from './db/db.ts';
import type { UserDoc } from './models.ts';
import type { LevelCache } from './services/levels.ts';

export interface Deps {
  config: Config;
  db: Db;
  levels: LevelCache;
  now: () => Date;
}

export interface AuthedUser {
  id: string;
  doc: UserDoc;
}

export interface AppEnv extends Env {
  Variables: { deps: Deps; user: AuthedUser | null };
}

/** Thrown anywhere in a handler; rendered as `{ error, message, ...extra }`. */
export class HttpError extends Error {
  constructor(
    readonly status: ContentfulStatusCode,
    readonly code: string,
    message: string,
    readonly extra: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

export const notFound = (what: string) => new HttpError(404, 'not_found', `${what} not found`);

/** Parses a JSON body with a zod schema, answering 400 with the issues on failure. */
export async function body<S extends z.ZodType>(c: Context, schema: S): Promise<z.infer<S>> {
  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    throw new HttpError(400, 'invalid_json', 'Request body must be JSON');
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    throw new HttpError(400, 'invalid_request', z.prettifyError(parsed.error), {
      issues: parsed.error.issues.map((i) => `${i.path.join('.') || 'body'}: ${i.message}`),
    });
  }
  return parsed.data;
}

/**
 * Language of game texts for this request: `?lang=`, else the first supported language of
 * the Accept-Language header, else English.
 */
export function gameLang(c: Context): Lang {
  const query = c.req.query('lang');
  if (isLang(query)) return query;
  const accepted = (c.req.header('Accept-Language') ?? '')
    .split(',')
    .map((part) => part.split(';')[0]!.trim().slice(0, 2).toLowerCase());
  return accepted.find(isLang) ?? DEFAULT_LANG;
}

/** Structured log line understood by Cloud Logging. */
export function log(severity: 'INFO' | 'WARNING' | 'ERROR', message: string, fields: Record<string, unknown> = {}): void {
  console.log(JSON.stringify({ severity, message, ...fields }));
}
