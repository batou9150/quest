import { newGame, step, type Command, type StepResult } from '@quest/engine';
import { HttpError, log, type AuthedUser, type Deps } from '../http.ts';
import { paths, type EventDoc, type EventScoreDoc, type ProgressDoc, type UserDoc } from '../models.ts';
import { eventStatus } from './events.ts';

/**
 * Makes a level the user's active one. Resumes an unfinished run unless `reset`.
 * A level is locked until the previous one is completed; admins can start any level to test it.
 */
export async function startLevel(deps: Deps, user: AuthedUser, levelId: string, reset: boolean): Promise<void> {
  const uid = user.id;
  const level = await deps.levels.get(levelId);
  if (!level) throw new HttpError(404, 'not_found', 'Level not found');
  const published = await deps.levels.published();
  const index = published.findIndex((l) => l.id === levelId);
  const previous = index > 0 ? published[index - 1] : undefined;

  await deps.db.transaction(async (tx) => {
    const progress = await tx.get<ProgressDoc>(paths.progress(uid, levelId));
    if (previous && !progress && user.doc.role !== 'admin') {
      const before = await tx.get<ProgressDoc>(paths.progress(uid, previous.id));
      if (before?.bestScore == null) throw new HttpError(403, 'level_locked', `Complete "${previous.title}" first`);
    }
    const keepRun = !reset && progress?.state && !progress.state.finished;
    tx.set(paths.progress(uid, levelId), {
      state: keepRun ? progress.state : newGame(level),
      bestScore: progress?.bestScore ?? null,
      completions: progress?.completions ?? 0,
      updatedAt: deps.now().toISOString(),
    } satisfies ProgressDoc);
    tx.merge(paths.user(uid), { activeLevelId: levelId });
  });
}

/**
 * Runs one game command on the user's active level, atomically.
 * On completion it records the best score, the user's total, and scores of running events.
 */
export async function play(deps: Deps, uid: string, command: Command): Promise<StepResult> {
  const { db, now } = deps;
  // Only a move can complete a level. Read outside the transaction: events change rarely.
  const runningEvents =
    command.type === 'move'
      ? (await db.list<EventDoc>('events', { where: [['endTime', '>', now().toISOString()]] })).filter(
          (e) => eventStatus(e.data, now()) === 'ACTIVE',
        )
      : [];

  const result = await db.transaction(async (tx) => {
    const user = await tx.get<UserDoc>(paths.user(uid));
    const levelId = user?.activeLevelId;
    const level = levelId ? await deps.levels.get(levelId) : undefined;
    const progress = levelId ? await tx.get<ProgressDoc>(paths.progress(uid, levelId)) : null;
    if (!user || !level || !progress?.state) {
      throw new HttpError(409, 'no_active_level', 'No active level. Start one from Level Select first.');
    }

    const out = step(level, progress.state, command);
    const completed = out.state.finished && !progress.state.finished;
    const events = completed ? runningEvents.filter((e) => !e.data.levelIds.length || e.data.levelIds.includes(level.id)) : [];
    const eventScores = await Promise.all(events.map((e) => tx.get<EventScoreDoc>(paths.eventScore(e.id, uid))));
    if (!completed && out.state.actions === progress.state.actions) return out.result; // look, inventory, finished level

    const updatedAt = now().toISOString();
    const score = out.state.score ?? 0;
    const bestScore = completed ? Math.max(score, progress.bestScore ?? 0) : progress.bestScore;
    tx.set(paths.progress(uid, level.id), {
      state: out.state,
      bestScore,
      completions: progress.completions + (completed ? 1 : 0),
      updatedAt,
    } satisfies ProgressDoc);

    if (completed) {
      const gain = (bestScore ?? 0) - (progress.bestScore ?? 0);
      if (gain > 0) tx.merge(paths.user(uid), { totalScore: user.totalScore + gain });
      events.forEach((event, i) => {
        const current = eventScores[i];
        const levels = { ...current?.levels, [level.id]: Math.max(score, current?.levels[level.id] ?? 0) };
        tx.set(paths.eventScore(event.id, uid), {
          displayName: user.displayName,
          score: Object.values(levels).reduce((a, b) => a + b, 0),
          levels,
          updatedAt,
        } satisfies EventScoreDoc);
      });
    }
    return out.result;
  });

  log('INFO', 'game_action', { uid, command: command.type, ok: result.ok, error: result.ok ? undefined : result.error });
  return result;
}
