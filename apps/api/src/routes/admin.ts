import { LevelValidationError, parseLevel } from '@quest/engine';
import {
  AdminLevelPatchSchema,
  AdminUpdateUserSchema,
  EventInputSchema,
  GuideInputSchema,
  SLUG_PATTERN,
  DEFAULT_LANG,
  type AdminGuide,
  type AdminLevel,
  type AdminUser,
  type EventSummary,
  type Guide,
  type Page,
} from '@quest/shared';
import { randomUUID } from 'node:crypto';
import { Hono, type Context } from 'hono';
import { requireAdmin, requireUser } from '../auth/session.ts';
import { body, HttpError, notFound, type AppEnv } from '../http.ts';
import { paths, type EventDoc, type GuideDoc, type LevelDoc, type UserDoc } from '../models.ts';
import { toEventSummary } from '../services/events.ts';
import { toAdminGuide, toGuide } from '../services/guides.ts';

const PAGE_SIZE = 50;

/** /api/admin/*: content and user management, admins only. */
export const admin = new Hono<AppEnv>();
admin.use('*', requireAdmin);

// --- Users ---------------------------------------------------------------

/** ?q= matches an exact email or a display-name prefix; ?cursor= is the last createdAt of the previous page. */
admin.get('/users', async (c) => {
  const { db } = c.get('deps');
  const q = c.req.query('q')?.trim().toLowerCase();
  const cursor = c.req.query('cursor');
  let docs;
  if (q?.includes('@')) {
    docs = await db.list<UserDoc>('users', { where: [['emailLower', '==', q]] });
  } else if (q) {
    docs = await db.list<UserDoc>('users', {
      where: [['displayNameLower', '>=', q], ['displayNameLower', '<', `${q}`]],
      orderBy: ['displayNameLower', 'asc'],
      limit: PAGE_SIZE,
    });
  } else {
    docs = await db.list<UserDoc>('users', { orderBy: ['createdAt', 'desc'], limit: PAGE_SIZE, startAfter: cursor });
  }
  const items: AdminUser[] = docs.map(({ id, data: u }) => ({
    id,
    displayName: u.displayName,
    email: u.email,
    avatarUrl: u.avatarUrl,
    provider: u.provider,
    role: u.role,
    banned: u.banned,
    totalScore: u.totalScore,
    createdAt: u.createdAt,
  }));
  const nextCursor = !q && items.length === PAGE_SIZE ? items.at(-1)!.createdAt : null;
  return c.json<Page<AdminUser>>({ items, nextCursor });
});

admin.patch('/users/:id', async (c) => {
  const me = requireUser(c);
  const id = c.req.param('id');
  const patch = await body(c, AdminUpdateUserSchema);
  if (id === me.id && (patch.role === 'player' || patch.banned)) {
    throw new HttpError(400, 'self_demotion', 'You cannot demote or ban yourself');
  }
  const { db } = c.get('deps');
  await db.transaction(async (tx) => {
    const user = await tx.get<UserDoc>(paths.user(id));
    if (!user) throw notFound('User');
    tx.merge(paths.user(id), patch);
  });
  return c.body(null, 204);
});

/** Deletes all progress and the total score. Event scores are history and are kept. */
admin.post('/users/:id/reset-progress', async (c) => {
  const id = c.req.param('id');
  const { db } = c.get('deps');
  if (!(await db.get<UserDoc>(paths.user(id)))) throw notFound('User');
  await db.deleteCollection(paths.progress(id));
  await db.merge(paths.user(id), { totalScore: 0, activeLevelId: null });
  return c.body(null, 204);
});

admin.delete('/users/:id/api-key', async (c) => {
  const id = c.req.param('id');
  const { db } = c.get('deps');
  await db.transaction(async (tx) => {
    const user = await tx.get<UserDoc>(paths.user(id));
    if (!user) throw notFound('User');
    if (user.apiKeyHash) tx.delete(paths.apiKey(user.apiKeyHash));
    tx.merge(paths.user(id), { apiKeyHash: null, apiKeyPrefix: null });
  });
  return c.body(null, 204);
});

// --- Levels --------------------------------------------------------------

admin.get('/levels', async (c) => {
  const docs = await c.get('deps').db.list<LevelDoc>('levels');
  const levels = docs.map(({ data: l }) => ({
    id: l.id,
    number: l.number,
    title: l.title,
    points: l.points,
    par: l.par,
    published: l.published,
    updatedAt: l.updatedAt,
  }));
  return c.json<AdminLevel[]>(levels.sort((a, b) => a.number - b.number));
});

admin.get('/levels/:id', async (c) => {
  const level = await c.get('deps').db.get<LevelDoc>(paths.level(c.req.param('id')));
  if (!level) throw notFound('Level');
  return c.json(level);
});

/** Creates or replaces a level. A new level starts unpublished; a replaced one keeps its published flag. */
admin.put('/levels/:id', async (c) => {
  let level;
  try {
    level = parseLevel(await c.req.json());
  } catch (e) {
    if (e instanceof LevelValidationError) throw new HttpError(400, 'invalid_level', e.message, { issues: e.issues });
    throw new HttpError(400, 'invalid_json', 'Request body must be JSON');
  }
  if (level.id !== c.req.param('id')) throw new HttpError(400, 'id_mismatch', `Body id "${level.id}" does not match the URL`);
  const { db, now, levels } = c.get('deps');
  const existing = await db.get<LevelDoc>(paths.level(level.id));
  await db.set(paths.level(level.id), { ...level, published: existing?.published ?? false, updatedAt: now().toISOString() });
  levels.invalidate();
  return c.json({ id: level.id, created: !existing }, existing ? 200 : 201);
});

admin.patch('/levels/:id', async (c) => {
  const { published } = await body(c, AdminLevelPatchSchema);
  const { db, now, levels } = c.get('deps');
  if (!(await db.get<LevelDoc>(paths.level(c.req.param('id'))))) throw notFound('Level');
  await db.merge(paths.level(c.req.param('id')), { published, updatedAt: now().toISOString() });
  levels.invalidate();
  return c.body(null, 204);
});

/** Player progress on a deleted level stays in Firestore but is no longer shown or playable. */
admin.delete('/levels/:id', async (c) => {
  const { db, levels } = c.get('deps');
  await db.delete(paths.level(c.req.param('id')));
  levels.invalidate();
  return c.body(null, 204);
});

// --- Events --------------------------------------------------------------

/** Stored in UTC so that string comparison in Firestore queries matches time order. */
const eventInput = async (c: Context<AppEnv>) => {
  const input = await body(c, EventInputSchema);
  return { ...input, startTime: new Date(input.startTime).toISOString(), endTime: new Date(input.endTime).toISOString() };
};

admin.post('/events', async (c) => {
  const input = await eventInput(c);
  const { db, now } = c.get('deps');
  const id = randomUUID();
  const event: EventDoc = { ...input, createdAt: now().toISOString() };
  await db.set(paths.event(id), event);
  return c.json<EventSummary>(toEventSummary(id, event, now()), 201);
});

admin.put('/events/:id', async (c) => {
  const input = await eventInput(c);
  const { db, now } = c.get('deps');
  const existing = await db.get<EventDoc>(paths.event(c.req.param('id')));
  if (!existing) throw notFound('Event');
  const event: EventDoc = { ...input, createdAt: existing.createdAt };
  await db.set(paths.event(c.req.param('id')), event);
  return c.json<EventSummary>(toEventSummary(c.req.param('id'), event, now()));
});

admin.delete('/events/:id', async (c) => {
  const { db } = c.get('deps');
  await db.deleteCollection(paths.eventScore(c.req.param('id')));
  await db.delete(paths.event(c.req.param('id')));
  return c.body(null, 204);
});

// --- Guides --------------------------------------------------------------

admin.get('/guides', async (c) => {
  const docs = await c.get('deps').db.list<GuideDoc>('guides');
  return c.json<Guide[]>(
    docs.map((g) => toGuide(g.id, g.data, DEFAULT_LANG, false)).sort((a, b) => a.title.localeCompare(b.title)),
  );
});

admin.get('/guides/:slug', async (c) => {
  const guide = await c.get('deps').db.get<GuideDoc>(paths.guide(c.req.param('slug')));
  if (!guide) throw notFound('Guide');
  return c.json<AdminGuide>(toAdminGuide(c.req.param('slug'), guide));
});

admin.put('/guides/:slug', async (c) => {
  const slug = c.req.param('slug');
  if (!SLUG_PATTERN.test(slug)) throw new HttpError(400, 'invalid_slug', 'Slug must be lowercase words separated by dashes');
  const input = await body(c, GuideInputSchema);
  const { db, now } = c.get('deps');
  const existing = await db.get<GuideDoc>(paths.guide(slug));
  const stamp = now().toISOString();
  const guide: GuideDoc = {
    ...input,
    author: existing?.author ?? requireUser(c).doc.displayName,
    publishedAt: existing?.published || !input.published ? (existing?.publishedAt ?? stamp) : stamp,
    updatedAt: stamp,
  };
  await db.set(paths.guide(slug), guide);
  return c.json<AdminGuide>(toAdminGuide(slug, guide), existing ? 200 : 201);
});

admin.delete('/guides/:slug', async (c) => {
  await c.get('deps').db.delete(paths.guide(c.req.param('slug')));
  return c.body(null, 204);
});
