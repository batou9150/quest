import { readdirSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { demoLevel } from '@quest/levels-demo';
import { GuideInputSchema, SLUG_PATTERN } from '@quest/shared';
import type { Db } from './db/db.ts';
import { log } from './http.ts';
import { paths, type GuideDoc, type LevelDoc } from './models.ts';

export const STARTER_AUTHOR = 'The Quantum Quest';

/**
 * Adds the public starter content (demo level, guides in content/guides/*.md) when it is missing.
 * Never overwrites admin edits. Deleted items come back on the next start; set SEED_DEMO=false to stop seeding.
 */
export async function seedContent(db: Db, guidesDir: string, now: Date): Promise<void> {
  if (!(await db.get(paths.level(demoLevel.id)))) {
    await db.set<LevelDoc>(paths.level(demoLevel.id), { ...demoLevel, published: true, updatedAt: now.toISOString() });
    log('INFO', `Seeded level ${demoLevel.id}`);
  }
  for (const [slug, guide, order] of loadGuides(guidesDir)) {
    if (await db.get(paths.guide(slug))) continue;
    // Guides are listed newest first: date them so that `order: 1` comes first.
    const stamp = new Date(now.getTime() - order * 60_000).toISOString();
    await db.set<GuideDoc>(paths.guide(slug), { ...guide, author: STARTER_AUTHOR, publishedAt: stamp, updatedAt: stamp });
    log('INFO', `Seeded guide ${slug}`);
  }
}

/** Reads `<slug>.md` files with a `---` front matter block of `key: value` lines (order, title, category, summary). */
export function loadGuides(dir: string) {
  const files = readdirSync(dir).filter((f) => f.endsWith('.md')).sort();
  return files.map((file) => {
    const slug = basename(file, '.md');
    if (!SLUG_PATTERN.test(slug)) throw new Error(`Guide file name is not a valid slug: ${file}`);
    const match = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(readFileSync(join(dir, file), 'utf8'));
    if (!match) throw new Error(`Guide ${file} has no front matter`);
    const meta = Object.fromEntries(
      match[1]!.split('\n').map((line) => {
        const i = line.indexOf(':');
        return [line.slice(0, i).trim(), line.slice(i + 1).trim()];
      }),
    );
    const { order = '99', ...fields } = meta;
    const guide = GuideInputSchema.parse({ ...fields, content: match[2]!.trim(), published: true });
    return [slug, guide, Number(order)] as const;
  });
}
