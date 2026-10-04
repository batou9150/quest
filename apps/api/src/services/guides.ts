import { DEFAULT_LANG, isLang, LANGS, type AdminGuide, type Guide, type GuideText, type Lang } from '@quest/shared';
import type { GuideDoc } from '../models.ts';

/**
 * Guides saved before they had languages stored their English texts at the top level.
 * Reading through this keeps them working without a migration.
 */
export function normalizeGuide(doc: GuideDoc | (Omit<GuideDoc, 'locales'> & GuideText)): GuideDoc {
  if ('locales' in doc && doc.locales) return doc;
  const { title, category, summary, content, ...shared } = doc as Omit<GuideDoc, 'locales'> & GuideText;
  return { ...shared, locales: { en: { title, category, summary, content } } };
}

export const guideLanguages = (doc: GuideDoc): Lang[] => LANGS.filter((lang) => doc.locales[lang]);

/** `?lang=` value, or English when missing or unsupported. */
export const requestedLang = (value: string | undefined): Lang => (isLang(value) ? value : DEFAULT_LANG);

/** The guide in `lang` when it is written in it, else in English. */
export function toGuide(slug: string, raw: GuideDoc, lang: Lang, withContent: boolean): Guide {
  const doc = normalizeGuide(raw);
  const shown = doc.locales[lang] ? lang : DEFAULT_LANG;
  const text = doc.locales[shown]!;
  return {
    slug,
    lang: shown,
    languages: guideLanguages(doc),
    title: text.title,
    category: text.category,
    author: doc.author,
    summary: text.summary,
    imageUrl: doc.imageUrl,
    published: doc.published,
    publishedAt: doc.publishedAt,
    ...(withContent ? { content: text.content } : {}),
  };
}

export function toAdminGuide(slug: string, raw: GuideDoc): AdminGuide {
  const doc = normalizeGuide(raw);
  return {
    slug,
    imageUrl: doc.imageUrl,
    published: doc.published,
    publishedAt: doc.publishedAt,
    author: doc.author,
    locales: doc.locales,
  };
}
