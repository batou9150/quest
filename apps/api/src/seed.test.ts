import { describe, expect, it } from 'vitest';
import { demoLevels } from '@quest/levels-demo';
import { loadConfig } from './config.ts';
import { MemoryDb } from './db/memory.ts';
import { paths, type GuideDoc } from './models.ts';
import { loadGuides, seedContent, STARTER_AUTHOR } from './seed.ts';

const { guidesDir } = loadConfig({});
const NOW = new Date('2026-10-04T12:00:00Z');

describe('starter content', () => {
  it('parses every guide in content/guides, in English and French', () => {
    const guides = loadGuides(guidesDir);
    expect(guides.map((g) => g.slug)).toEqual(['playing-with-the-api', 'what-is-a-text-adventure', 'writing-a-bot']);
    for (const { guide } of guides) {
      expect(Object.keys(guide.locales).sort()).toEqual(['en', 'fr']);
      for (const text of Object.values(guide.locales)) {
        expect(text.title).not.toBe('');
        expect(text.content).not.toMatch(/^---/);
      }
      expect(guide.imageUrl).toMatch(/^https:/);
    }
  });

  it('seeds the demo levels and published guides without overwriting admin edits', async () => {
    const db = new MemoryDb();
    const edited = { title: 'Edited by an admin', author: 'Boss' };
    await db.set(paths.guide('writing-a-bot'), edited);
    await seedContent(db, guidesDir, NOW);

    for (const level of demoLevels) expect(await db.get(paths.level(level.id))).toMatchObject({ published: true });
    expect(await db.get(paths.guide('playing-with-the-api'))).toMatchObject({ published: true, author: STARTER_AUTHOR });
    expect(await db.get(paths.guide('writing-a-bot'))).toEqual(edited);
    const intro = await db.get<GuideDoc>(paths.guide('what-is-a-text-adventure'));
    const api = await db.get<GuideDoc>(paths.guide('playing-with-the-api'));
    expect(intro!.publishedAt > api!.publishedAt).toBe(true);
  });

  it('adds new translations to starter guides seeded before them, keeping their texts', async () => {
    const db = new MemoryDb();
    // A starter guide saved before guides had languages: English texts at the top level.
    const legacy = {
      title: 'Old title',
      category: 'General',
      summary: '',
      content: 'Old content',
      imageUrl: null,
      published: true,
      author: STARTER_AUTHOR,
      publishedAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    await db.set(paths.guide('writing-a-bot'), legacy);
    await seedContent(db, guidesDir, NOW);

    const guide = await db.get<GuideDoc>(paths.guide('writing-a-bot'));
    expect(guide!.locales.en).toMatchObject({ title: 'Old title', content: 'Old content' });
    expect(guide!.locales.fr?.title).toBe('Écrire un bot');
    expect(guide!.publishedAt).toBe(legacy.publishedAt);
  });
});
