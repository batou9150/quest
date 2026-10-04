import { Hono } from 'hono';
import { StartLevelSchema, UpdateProfileSchema, type LevelSummary, type Me, type NameSuggestions, type NewApiKey } from '@quest/shared';
import { randomToken, requireUser, sha256 } from '../auth/session.ts';
import { body, notFound, type AppEnv, type AuthedUser } from '../http.ts';
import { paths, type ApiKeyDoc, type UserDoc } from '../models.ts';
import { startLevel } from '../services/game.ts';
import { loadProgress, summarize } from '../services/levels.ts';

/** /api/me and /api/levels: the logged-in player's own data. */
export const me = new Hono<AppEnv>();

me.get('/me', (c) => c.json<Me>(toMe(requireUser(c))));

me.patch('/me', async (c) => {
  const user = requireUser(c);
  const patch = await body(c, UpdateProfileSchema);
  const update: Partial<UserDoc> = { ...patch };
  if (patch.displayName) update.displayNameLower = patch.displayName.toLowerCase();
  await c.get('deps').db.merge(paths.user(user.id), update);
  return c.json<Me>(toMe({ id: user.id, doc: { ...user.doc, ...update } }));
});

const PRESET_NAMES = ['Thunder Sentinel', 'Questing Fang', 'Stone Tide', 'Silent Cipher', 'Iron Wanderer', 'Neon Specter'];
const ADJECTIVES = ['Dauntless', 'Valiant', 'Swift', 'Silent', 'Fearless', 'Clever', 'Wandering', 'Radiant'];

me.get('/me/name-suggestions', (c) => {
  const { doc } = requireUser(c);
  const pick = <T>(xs: T[], n: number) => [...xs].sort(() => Math.random() - 0.5).slice(0, n);
  const personal = doc.firstName ? pick(ADJECTIVES, 3).map((a) => `${a} ${doc.firstName}`) : [];
  return c.json<NameSuggestions>({ suggestions: [...pick(PRESET_NAMES, 3), ...personal] });
});

/** Generates a new API key and revokes the previous one. The key itself is never stored. */
me.post('/me/api-key', async (c) => {
  const user = requireUser(c);
  const { db, now } = c.get('deps');
  const apiKey = `qk_${randomToken(24)}`;
  const apiKeyHash = sha256(apiKey);
  const apiKeyPrefix = apiKey.slice(0, 7);
  await db.transaction(async (tx) => {
    const current = await tx.get<UserDoc>(paths.user(user.id));
    if (current?.apiKeyHash) tx.delete(paths.apiKey(current.apiKeyHash));
    tx.set(paths.apiKey(apiKeyHash), { uid: user.id, createdAt: now().toISOString() } satisfies ApiKeyDoc);
    tx.merge(paths.user(user.id), { apiKeyHash, apiKeyPrefix });
  });
  return c.json<NewApiKey>({ apiKey, apiKeyPrefix }, 201);
});

me.get('/levels', async (c) => {
  const user = requireUser(c);
  const { db, levels } = c.get('deps');
  const progress = await loadProgress(db, user.id);
  return c.json<LevelSummary[]>(summarize(await levels.published(), progress, user.doc.activeLevelId));
});

me.post('/levels/:id/start', async (c) => {
  const user = requireUser(c);
  const { reset } = await body(c, StartLevelSchema);
  const deps = c.get('deps');
  await startLevel(deps, user, c.req.param('id'), reset);
  const summaries = summarize(await deps.levels.published(), await loadProgress(deps.db, user.id), c.req.param('id'));
  const level = summaries.find((l) => l.id === c.req.param('id'));
  if (!level) throw notFound('Level');
  return c.json<LevelSummary>(level);
});

function toMe({ id, doc }: AuthedUser): Me {
  return {
    id,
    displayName: doc.displayName,
    firstName: doc.firstName,
    lastName: doc.lastName,
    email: doc.email,
    avatarUrl: doc.avatarUrl,
    bio: doc.bio,
    role: doc.role,
    totalScore: doc.totalScore,
    activeLevelId: doc.activeLevelId,
    apiKeyPrefix: doc.apiKeyPrefix,
    createdAt: doc.createdAt,
  };
}
