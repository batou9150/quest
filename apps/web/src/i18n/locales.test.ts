import { describe, expect, it } from 'vitest';
import en from './locales/en.json';
import fr from './locales/fr.json';

type Tree = { [key: string]: string | Tree };
const PLURAL = /_(zero|one|two|few|many|other)$/;

function flatten(tree: Tree, prefix = ''): Map<string, string> {
  const out = new Map<string, string>();
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') out.set(path, value);
    else for (const [k, v] of flatten(value, path)) out.set(k, v);
  }
  return out;
}

const locales = { en: flatten(en as Tree), fr: flatten(fr as Tree) };
/** Keys without their plural suffix: each language has the plural forms its own grammar needs. */
const baseKeys = (keys: Map<string, string>) => [...new Set([...keys.keys()].map((k) => k.replace(PLURAL, '')))].sort();

describe('translations', () => {
  it('en and fr have exactly the same keys (plural forms aside)', () => {
    expect(baseKeys(locales.fr)).toEqual(baseKeys(locales.en));
  });

  it('non-plural keys match exactly', () => {
    const plain = (m: Map<string, string>) => [...m.keys()].filter((k) => !PLURAL.test(k)).sort();
    expect(plain(locales.fr)).toEqual(plain(locales.en));
  });

  it.each(Object.entries(locales))('%s has every plural form its language needs', (lang, keys) => {
    const categories = new Intl.PluralRules(lang).resolvedOptions().pluralCategories;
    const plurals = new Set([...keys.keys()].filter((k) => PLURAL.test(k)).map((k) => k.replace(PLURAL, '')));
    for (const base of plurals) for (const c of categories) expect(keys.has(`${base}_${c}`), `${lang}: ${base}_${c}`).toBe(true);
  });

  it.each(Object.entries(locales))('%s has no empty values', (_lang, keys) => {
    for (const [key, value] of keys) expect(value.trim(), key).not.toBe('');
  });

  it('fr uses the same <tags> as English (rendered by <Trans>)', () => {
    const tags = (s: string) => [...s.matchAll(/<\/?([a-z]+)>/g)].map((m) => m[0]).sort();
    for (const [key, value] of locales.fr) {
      const reference = locales.en.get(key) ?? locales.en.get(key.replace(PLURAL, '_other'));
      // Only markup with closing tags is parsed by <Trans>; "<thing>" placeholders in plain texts are translated freely.
      if (reference?.includes('</')) expect(tags(value), key).toEqual(tags(reference));
    }
  });

  it.each(Object.entries(locales))('%s uses the same interpolation variables as English', (lang, keys) => {
    const vars = (s: string) => [...s.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]).sort();
    for (const [key, value] of keys) {
      const reference = locales.en.get(key) ?? locales.en.get(key.replace(PLURAL, '_other'));
      if (reference !== undefined) expect(vars(value), `${lang}: ${key}`).toEqual(vars(reference));
    }
  });
});
