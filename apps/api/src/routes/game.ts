import type { Command } from '@quest/engine';
import { Hono, type Context } from 'hono';
import { z } from 'zod';
import { requireUser } from '../auth/session.ts';
import { body, HttpError, type AppEnv } from '../http.ts';
import { play } from '../services/game.ts';

/** /game/*: the public game API (see openapi.json), on the caller's active level. */
export const game = new Hono<AppEnv>();

/** Fixed one-minute windows per user, per instance. Good enough to stop runaway scripts. */
const windows = new Map<string, { start: number; count: number }>();

game.use('*', async (c, next) => {
  const user = requireUser(c);
  const limit = c.get('deps').config.gameRateLimit;
  const now = Date.now();
  let w = windows.get(user.id);
  if (!w || now - w.start >= 60_000) {
    if (windows.size > 10_000) windows.clear();
    w = { start: now, count: 0 };
    windows.set(user.id, w);
  }
  w.count += 1;
  c.header('X-RateLimit-Limit', String(limit));
  c.header('X-RateLimit-Remaining', String(Math.max(0, limit - w.count)));
  if (w.count > limit) {
    c.header('Retry-After', String(Math.ceil((w.start + 60_000 - now) / 1000)));
    throw new HttpError(429, 'rate_limited', `Too many requests: ${limit} game calls per minute.`);
  }
  await next();
});

const text = z.string().trim().min(1).max(100);

game.get('/look', (c) => run(c, { type: 'look' }));
game.get('/inventory', (c) => run(c, { type: 'inventory' }));
game.post('/examine', async (c) => run(c, { type: 'examine', ...(await body(c, z.object({ target: text }))) }));
game.post('/move', async (c) => run(c, { type: 'move', ...(await body(c, z.object({ exit: text }))) }));
game.post('/take', async (c) => run(c, { type: 'take', ...(await body(c, z.object({ itemName: text }))) }));
game.post('/drop', async (c) => run(c, { type: 'drop', ...(await body(c, z.object({ itemName: text }))) }));
game.post('/use', async (c) =>
  run(c, {
    type: 'use',
    ...(await body(c, z.object({ direct_object: text, indirect_object: text.nullish() }))),
  }),
);

async function run(c: Context<AppEnv>, command: Command) {
  const result = await play(c.get('deps'), requireUser(c).id, command);
  if (!result.ok) throw new HttpError(400, result.error, result.message);
  return c.json(result.body as object);
}

/** Test helper: forget rate-limit windows between tests. */
export function resetRateLimits(): void {
  windows.clear();
}
