import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { BookOpen, CalendarDays, Search, User } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Guide } from '@quest/shared';
import { useApi } from '../lib/hooks';
import { formatDate } from '../lib/format';
import { useLang } from '../i18n';
import { PageHeader } from '../components/PageHeader';
import { Empty, ErrorMessage, Loading } from '../components/Status';
import { chip, chipActive, chipIdle, input } from '../components/ui';

export function Guides() {
  const { t } = useTranslation();
  const lang = useLang();
  const { data, error, loading, reload } = useApi<Guide[]>(`/api/guides?lang=${lang}`);
  const [query, setQuery] = useState('');
  const [selectedCategory, setCategory] = useState<string | null>(null);

  const categories = useMemo(() => [...new Set((data ?? []).map((g) => g.category))].sort(), [data]);
  // Categories are translated too: a choice made in another language no longer filters anything.
  const category = selectedCategory !== null && categories.includes(selectedCategory) ? selectedCategory : null;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (data ?? []).filter(
      (g) =>
        (category === null || g.category === category) &&
        (!q || [g.title, g.summary, g.category].some((field) => field.toLowerCase().includes(q))),
    );
  }, [data, query, category]);

  return (
    <div className="space-y-8">
      <PageHeader
        title={t('guides.title')}
        subtitle={t('guides.subtitle')}
        icon={<BookOpen className="text-quantum-400" aria-hidden />}
        actions={
          <div className="relative w-full sm:w-64">
            <label htmlFor="guide-search" className="sr-only">
              {t('guides.search')}
            </label>
            <Search className="pointer-events-none absolute left-3 top-2.5 text-slate-500" size={18} aria-hidden />
            <input
              id="guide-search"
              type="search"
              placeholder={t('guides.searchPlaceholder')}
              className={`${input} pl-10`}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        }
      />

      {loading && !data ? (
        <Loading label={t('guides.loading')} />
      ) : error ? (
        <ErrorMessage error={error} onRetry={reload} title={t('guides.loadError')} />
      ) : (
        <>
          {categories.length > 0 && (
            <div className="flex flex-wrap gap-2" role="group" aria-label={t('guides.filter')}>
              <button type="button" aria-pressed={category === null} className={`${chip} ${category === null ? chipActive : chipIdle}`} onClick={() => setCategory(null)}>
                {t('guides.all')}
              </button>
              {categories.map((c) => (
                <button key={c} type="button" aria-pressed={category === c} className={`${chip} ${category === c ? chipActive : chipIdle}`} onClick={() => setCategory(category === c ? null : c)}>
                  {c}
                </button>
              ))}
            </div>
          )}

          {filtered.length === 0 ? (
            <Empty>{data && data.length > 0 ? t('guides.noMatch') : t('guides.empty')}</Empty>
          ) : (
            <div className="grid gap-6 xl:grid-cols-2">
              {filtered.map((guide) => (
                <Link
                  key={guide.slug}
                  to={`/guides/${guide.slug}`}
                  className="group flex flex-col overflow-hidden rounded-xl border border-slate-800 bg-slate-900 transition-all hover:border-quantum-500/50"
                >
                  <div className="relative h-40 overflow-hidden bg-gradient-to-br from-quantum-950 via-slate-900 to-accent-950">
                    {guide.imageUrl && (
                      <img src={guide.imageUrl} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                    )}
                    <span className="absolute left-4 top-4 rounded border border-white/10 bg-black/60 px-2 py-1 text-xs font-bold uppercase tracking-wide text-white backdrop-blur-md">
                      {guide.category}
                    </span>
                  </div>
                  <div className="flex flex-1 flex-col p-5">
                    <h2 lang={guide.lang} className="mb-2 text-xl font-bold text-white transition-colors group-hover:text-quantum-400">
                      {guide.title}
                      {guide.lang !== lang && (
                        <span title={t('guides.otherLanguage')} className="ml-2 rounded border border-slate-700 px-1.5 py-0.5 align-middle font-mono text-[10px] font-bold uppercase text-slate-400">
                          {guide.lang}
                          <span className="sr-only"> ({t('guides.otherLanguage')})</span>
                        </span>
                      )}
                    </h2>
                    {guide.summary && (
                      <p lang={guide.lang} className="line-clamp-3 text-sm text-slate-400">
                        {guide.summary}
                      </p>
                    )}
                    <div className="mt-auto flex items-center justify-between gap-2 border-t border-slate-800/50 pt-4 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <User size={14} aria-hidden /> {guide.author}
                      </span>
                      <span className="flex items-center gap-1">
                        <CalendarDays size={14} aria-hidden /> {formatDate(guide.publishedAt)}
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
