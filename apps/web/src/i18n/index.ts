/**
 * Website translations (English + French), bundled: no runtime fetching, no eval (strict CSP).
 * Game texts from the server (rooms, items, /game/* messages) are requested in the site language with `?lang=`;
 * game commands and API error messages stay in English.
 */
import i18n from 'i18next';
import { initReactI18next, useTranslation } from 'react-i18next';
import { z } from 'zod';
import { en as zodEn, fr as zodFr } from 'zod/locales';
import { DEFAULT_LANG, isLang, LANGS, type Lang } from '@quest/shared';
import en from './locales/en.json';
import fr from './locales/fr.json';

export const resources = { en: { translation: en }, fr: { translation: fr } } as const;

export const STORAGE_KEY = 'quest.lang';

/** Each language's name in that language, for the switcher (deliberately not translated). */
export const LANG_ENDONYMS: Record<Lang, string> = { en: 'English', fr: 'Français' };

function savedLanguage(): Lang | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return isLang(value) ? value : null;
  } catch {
    return null;
  }
}

/** Saved choice, else the browser's preferred languages (any fr* → French), else English. */
export function detectLanguage(): Lang {
  const saved = savedLanguage();
  if (saved) return saved;
  const preferred = typeof navigator === 'undefined' ? [] : navigator.languages?.length ? navigator.languages : [navigator.language];
  if (preferred.some((l) => l?.toLowerCase().startsWith('fr'))) return 'fr';
  return DEFAULT_LANG;
}

function applyLanguage(lang: Lang): void {
  if (typeof document !== 'undefined') document.documentElement.lang = lang;
  // Validation messages from zod schemas follow the site language.
  z.config(lang === 'fr' ? zodFr() : zodEn());
}

i18n.on('languageChanged', (lng) => applyLanguage(isLang(lng) ? lng : DEFAULT_LANG));

void i18n.use(initReactI18next).init({
  resources,
  lng: detectLanguage(),
  fallbackLng: DEFAULT_LANG,
  supportedLngs: [...LANGS],
  initAsync: false,
  interpolation: { escapeValue: false }, // React already escapes.
});

/** Switches the site language and remembers the choice in this browser. */
export function setLanguage(lang: Lang): void {
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    // Storage unavailable (private mode...): the choice lasts until the page is reloaded.
  }
  void i18n.changeLanguage(lang);
}

/** The current site language (outside React). */
export function currentLang(): Lang {
  const lng = i18n.resolvedLanguage ?? i18n.language;
  return isLang(lng) ? lng : DEFAULT_LANG;
}

/** The current site language; re-renders the component when it changes. */
export function useLang(): Lang {
  const { i18n: instance } = useTranslation();
  const lng = instance.resolvedLanguage ?? instance.language;
  return isLang(lng) ? lng : DEFAULT_LANG;
}

export default i18n;
