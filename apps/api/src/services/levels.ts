import type { Level } from '@quest/engine';
import type { LevelStatus, LevelSummary } from '@quest/shared';
import type { Db } from '../db/db.ts';
import { paths, type LevelDoc, type ProgressDoc } from '../models.ts';

/**
 * Published levels, cached per instance for a short time: every game call needs its level,
 * and levels only change when an admin uploads one.
 */
export class LevelCache {
  private cache: { at: number; levels: LevelDoc[] } | null = null;

  constructor(
    private readonly db: Db,
    private readonly ttlMs = 30_000,
  ) {}

  async published(): Promise<LevelDoc[]> {
    if (!this.cache || Date.now() - this.cache.at > this.ttlMs) {
      const docs = await this.db.list<LevelDoc>('levels', { where: [['published', '==', true]] });
      this.cache = { at: Date.now(), levels: docs.map((d) => d.data).sort((a, b) => a.number - b.number) };
    }
    return this.cache.levels;
  }

  async get(id: string): Promise<Level | undefined> {
    return (await this.published()).find((l) => l.id === id);
  }

  invalidate(): void {
    this.cache = null;
  }
}

/** Level n is unlocked once the previous published level has been completed; the first is always open. */
export function summarize(
  levels: Level[],
  progress: Map<string, ProgressDoc>,
  activeLevelId: string | null,
): LevelSummary[] {
  return levels.map((level, i) => {
    const p = progress.get(level.id);
    const previous = i > 0 ? progress.get(levels[i - 1]!.id) : undefined;
    let status: LevelStatus;
    if (p?.state && !p.state.finished) status = 'IN_PROGRESS';
    else if (p?.bestScore != null) status = 'PLAYED';
    else if (i === 0 || previous?.bestScore != null) status = 'AVAILABLE';
    else status = 'LOCKED';
    return {
      id: level.id,
      number: level.number,
      title: level.title,
      summary: level.summary,
      points: level.points,
      status,
      active: level.id === activeLevelId,
      bestScore: p?.bestScore ?? null,
    };
  });
}

export async function loadProgress(db: Db, uid: string): Promise<Map<string, ProgressDoc>> {
  const docs = await db.list<ProgressDoc>(paths.progress(uid));
  return new Map(docs.map((d) => [d.id, d.data]));
}
