import { readdirSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { parseLevel } from '@quest/engine';
import { demoLevels } from '@quest/levels-demo';
import { DEFAULT_LANG, GuideInputSchema, GuideTextSchema, isLang, LANGS, SLUG_PATTERN, type GuideText, type Lang } from '@quest/shared';
import type { Db } from './db/db.ts';
import { log } from './http.ts';
import { paths, type GuideDoc, type LevelDoc } from './models.ts';
import { normalizeGuide } from './services/guides.ts';

export const STARTER_AUTHOR = 'The Quantum Quest';

/**
 * Adds the public starter content (demo levels, guides in content/guides/*.md) when it is missing,
 * and translations missing from demo levels and starter guides.
 * Never overwrites admin edits. Deleted items come back on the next start; set SEED_DEMO=false to stop seeding.
 */
export async function seedContent(db: Db, guidesDir: string, now: Date): Promise<void> {
  for (const level of demoLevels) {
    const existing = await db.get<LevelDoc>(paths.level(level.id));
    if (!existing) {
      await db.set<LevelDoc>(paths.level(level.id), { ...level, published: true, updatedAt: now.toISOString() });
      log('INFO', `Seeded level ${level.id}`);
      continue;
    }
    // A demo level that exists may lack a translation added since: add it, unless the level was edited so that it no longer fits.
    const current = existing.locales ?? {};
    const missing = Object.keys(level.locales).filter((lang) => !current[lang]);
    if (!missing.length) continue;
    const locales = { ...current, ...Object.fromEntries(missing.map((lang) => [lang, level.locales[lang]])) };
    try {
      parseLevel({ ...existing, locales });
    } catch {
      log('WARNING', `Level ${level.id} was edited: its ${missing.join(', ')} translation was not added`);
      continue;
    }
    await db.merge(paths.level(level.id), { locales, updatedAt: now.toISOString() });
    log('INFO', `Seeded level ${level.id} translations: ${missing.join(', ')}`);
  }
  for (const { slug, order, guide } of loadGuides(guidesDir)) {
    const existing = await db.get<GuideDoc>(paths.guide(slug));
    if (!existing) {
      // Guides are listed newest first: date them so that `order: 1` comes first.
      const stamp = new Date(now.getTime() - order * 60_000).toISOString();
      await db.set<GuideDoc>(paths.guide(slug), { ...guide, author: STARTER_AUTHOR, publishedAt: stamp, updatedAt: stamp });
      log('INFO', `Seeded guide ${slug}`);
      continue;
    }
    // A starter guide that exists may lack a translation added since: add it, never touch existing texts.
    const current = normalizeGuide(existing);
    if (current.author !== STARTER_AUTHOR) continue;
    const missing = LANGS.filter((lang) => guide.locales[lang] && !current.locales[lang]);
    if (!missing.length) continue;
    const locales = { ...current.locales, ...Object.fromEntries(missing.map((lang) => [lang, guide.locales[lang]])) };
    await db.set<GuideDoc>(paths.guide(slug), { ...current, locales, updatedAt: now.toISOString() });
    log('INFO', `Seeded guide ${slug} translations: ${missing.join(', ')}`);
  }
}

/**
 * Reads the starter guides: `<slug>.md` is the English guide, `<slug>.<lang>.md` (e.g. `.fr.md`) a translation.
 * Each file starts with a `---` front matter block of `key: value` lines: title, category, summary;
 * the English file also holds the shared `order` (listing position) and `imageUrl`.
 */
export function loadGuides(dir: string) {
  const texts = new Map<string, Partial<Record<Lang, GuideText>>>();
  const shared = new Map<string, { order: number; imageUrl: string | null }>();
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.md')).sort()) {
    const [, slug = '', lang = DEFAULT_LANG] = /^(.+?)(?:\.([a-z]{2}))?\.md$/.exec(file) ?? [];
    if (!SLUG_PATTERN.test(slug)) throw new Error(`Guide file name is not a valid slug: ${file}`);
    if (!isLang(lang)) throw new Error(`Guide ${file}: unsupported language "${lang}" (supported: ${LANGS.join(', ')})`);
    const match = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(readFileSync(join(dir, file), 'utf8'));
    if (!match) throw new Error(`Guide ${file} has no front matter`);
    const meta = Object.fromEntries(
      match[1]!.split('\n').map((line) => {
        const i = line.indexOf(':');
        return [line.slice(0, i).trim(), line.slice(i + 1).trim()];
      }),
    );
    const { order, imageUrl, ...text } = meta;
    texts.set(slug, { ...texts.get(slug), [lang]: GuideTextSchema.parse({ ...text, content: match[2]!.trim() }) });
    if (lang === DEFAULT_LANG) shared.set(slug, { order: Number(order ?? 99), imageUrl: imageUrl || null });
  }
  return [...texts].map(([slug, locales]) => {
    if (!locales.en || !shared.has(slug)) throw new Error(`Guide "${slug}" has a translation but no English ${slug}.md`);
    const guide = GuideInputSchema.parse({ imageUrl: shared.get(slug)!.imageUrl, published: true, locales });
    return { slug, order: shared.get(slug)!.order, guide };
  });
}
