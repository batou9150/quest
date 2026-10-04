import { Link, useParams } from 'react-router';
import { CalendarDays, ChevronLeft, User } from 'lucide-react';
import type { Guide } from '@quest/shared';
import { ApiError } from '../lib/api';
import { useApi } from '../lib/hooks';
import { formatDate } from '../lib/format';
import { ErrorMessage, Loading } from '../components/Status';
import { Markdown } from '../components/Markdown';
import { NotFound } from './NotFound';

export function GuideDetail() {
  const { slug = '' } = useParams();
  const { data: guide, error, loading, reload } = useApi<Guide>(`/api/guides/${encodeURIComponent(slug)}`);

  if (loading && !guide) return <Loading label="Loading guide…" />;
  if (error instanceof ApiError && error.status === 404) return <NotFound />;
  if (error || !guide) return <ErrorMessage error={error} onRetry={reload} title="Could not load this guide" />;

  return (
    <article className="mx-auto max-w-3xl space-y-8">
      <Link to="/guides" className="inline-flex items-center text-sm text-slate-400 transition-colors hover:text-white">
        <ChevronLeft size={16} className="mr-1" aria-hidden /> Back to Guides
      </Link>
      <header className="space-y-4">
        <span className="inline-block rounded border border-quantum-800 bg-quantum-950 px-2 py-1 text-xs font-bold uppercase tracking-wide text-quantum-300">
          {guide.category}
        </span>
        <h1 className="text-3xl font-bold text-white sm:text-4xl">{guide.title}</h1>
        {guide.summary && <p className="text-lg text-slate-400">{guide.summary}</p>}
        <div className="flex flex-wrap gap-4 text-sm text-slate-500">
          <span className="flex items-center gap-1">
            <User size={14} aria-hidden /> {guide.author}
          </span>
          <span className="flex items-center gap-1">
            <CalendarDays size={14} aria-hidden /> {formatDate(guide.publishedAt)}
          </span>
          {!guide.published && <span className="font-mono text-amber-400">DRAFT</span>}
        </div>
        {guide.imageUrl && <img src={guide.imageUrl} alt="" className="w-full rounded-xl border border-slate-800" />}
      </header>
      <Markdown>{guide.content ?? ''}</Markdown>
    </article>
  );
}
