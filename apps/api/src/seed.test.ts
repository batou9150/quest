import { describe, expect, it } from 'vitest';
import { demoLevels } from '@quest/levels-demo';
import { loadConfig } from './config.ts';
import { MemoryDb } from './db/memory.ts';
import { paths, type GuideDoc } from './models.ts';
import { loadGuides, seedContent, STARTER_AUTHOR } from './seed.ts';

const { guidesDir } = loadConfig({});
const NOW = new Date('2026-10-04T12:00:00Z');

describe('starter content', () => {
  it('parses every guide in content/guides', () => {
    const guides = loadGuides(guidesDir);
    expect(guides.map(([slug]) => slug)).toEqual(['playing-with-the-api', 'what-is-a-text-adventure', 'writing-a-bot']);
    for (const [, guide] of guides) {
      expect(guide.title).not.toBe('');
      expect(guide.content).not.toMatch(/^---/);
    }
  });

  it('seeds the demo levels and published guides without overwriting admin edits', async () => {
    const db = new MemoryDb();
    await db.set<Partial<GuideDoc>>(paths.guide('writing-a-bot'), { title: 'Edited by an admin' });
    await seedContent(db, guidesDir, NOW);

    for (const level of demoLevels) expect(await db.get(paths.level(level.id))).toMatchObject({ published: true });
    expect(await db.get(paths.guide('playing-with-the-api'))).toMatchObject({ published: true, author: STARTER_AUTHOR });
    expect(await db.get(paths.guide('writing-a-bot'))).toEqual({ title: 'Edited by an admin' });
    const intro = await db.get<GuideDoc>(paths.guide('what-is-a-text-adventure'));
    const api = await db.get<GuideDoc>(paths.guide('playing-with-the-api'));
    expect(intro!.publishedAt > api!.publishedAt).toBe(true);
  });
});
