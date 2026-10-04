import { Hono } from 'hono';
import type { EventSummary, Guide, LeaderboardEntry } from '@quest/shared';
import { notFound, type AppEnv } from '../http.ts';
import { paths, type EventDoc, type EventScoreDoc, type GuideDoc } from '../models.ts';
import { toEventSummary } from '../services/events.ts';
import { requestedLang, toGuide } from '../services/guides.ts';

const LEADERBOARD_SIZE = 100;

/** Public read-only content: events, leaderboards, guides. */
export const publicRoutes = new Hono<AppEnv>();

publicRoutes.get('/events', async (c) => {
  const { db, now } = c.get('deps');
  const events = await db.list<EventDoc>('events', { orderBy: ['startTime', 'desc'] });
  return c.json<EventSummary[]>(events.map((e) => toEventSummary(e.id, e.data, now())));
});

publicRoutes.get('/events/:id', async (c) => {
  const { db, now } = c.get('deps');
  const event = await db.get<EventDoc>(paths.event(c.req.param('id')));
  if (!event) throw notFound('Event');
  return c.json<EventSummary>(toEventSummary(c.req.param('id'), event, now()));
});

publicRoutes.get('/events/:id/leaderboard', async (c) => {
  const { db } = c.get('deps');
  const id = c.req.param('id');
  if (!(await db.get<EventDoc>(paths.event(id)))) throw notFound('Event');
  const scores = await db.list<EventScoreDoc>(paths.eventScore(id), { orderBy: ['score', 'desc'], limit: LEADERBOARD_SIZE });
  c.header('Cache-Control', 'public, max-age=10');
  return c.json<LeaderboardEntry[]>(
    scores.map((s, i) => ({ rank: i + 1, userId: s.id, displayName: s.data.displayName, score: s.data.score })),
  );
});

publicRoutes.get('/guides', async (c) => {
  const { db } = c.get('deps');
  const lang = requestedLang(c.req.query('lang'));
  const guides = await db.list<GuideDoc>('guides', { where: [['published', '==', true]] });
  return c.json<Guide[]>(
    guides
      .map((g) => toGuide(g.id, g.data, lang, false))
      .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)),
  );
});

publicRoutes.get('/guides/:slug', async (c) => {
  const user = c.get('user');
  const guide = await c.get('deps').db.get<GuideDoc>(paths.guide(c.req.param('slug')));
  // Drafts are visible to admins only, for previews.
  if (!guide || (!guide.published && user?.doc.role !== 'admin')) throw notFound('Guide');
  return c.json<Guide>(toGuide(c.req.param('slug'), guide, requestedLang(c.req.query('lang')), true));
});
