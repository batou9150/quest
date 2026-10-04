import { Link } from 'react-router';
import { CalendarDays, Flag, Trophy } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { EventSummary } from '@quest/shared';
import { useApi } from '../lib/hooks';
import { formatDateTime } from '../lib/format';
import { PageHeader } from '../components/PageHeader';
import { Empty, ErrorMessage, Loading } from '../components/Status';
import { EventStatusBadge } from '../components/EventStatusBadge';

export function Events() {
  const { t } = useTranslation();
  const { data, error, loading, reload } = useApi<EventSummary[]>('/api/events');

  return (
    <div className="space-y-8">
      <PageHeader title={t('events.title')} subtitle={t('events.subtitle')} icon={<Trophy className="text-quantum-400" aria-hidden />} />
      {loading && !data ? (
        <Loading label={t('events.loading')} />
      ) : error ? (
        <ErrorMessage error={error} onRetry={reload} title={t('events.loadError')} />
      ) : !data || data.length === 0 ? (
        <Empty>{t('events.empty')}</Empty>
      ) : (
        <div className="grid gap-6 xl:grid-cols-2">
          {data.map((event) => (
            <Link key={event.id} to={`/events/${encodeURIComponent(event.id)}`} className="group block">
              <article className="relative h-full overflow-hidden rounded-xl border border-slate-800 bg-slate-900 p-6 transition-all hover:border-quantum-500/50 hover:shadow-[0_0_20px_rgba(34,211,238,0.1)]">
                <Trophy aria-hidden size={96} className="absolute -right-2 -top-2 text-slate-800 opacity-40 transition-opacity group-hover:opacity-70" />
                <div className="relative space-y-4">
                  <EventStatusBadge status={event.status} />
                  <div>
                    <h2 className="text-xl font-bold text-white transition-colors group-hover:text-quantum-400">{event.title}</h2>
                    {event.shortDescription && <p className="mt-2 line-clamp-2 text-sm text-slate-400">{event.shortDescription}</p>}
                  </div>
                  <dl className="space-y-1 border-t border-slate-800/50 pt-4 font-mono text-xs text-slate-500">
                    <div className="flex items-center gap-2">
                      <CalendarDays size={14} aria-hidden />
                      <dt className="sr-only">{t('events.starts')}</dt>
                      <dd>{formatDateTime(event.startTime)}</dd>
                    </div>
                    <div className="flex items-center gap-2">
                      <Flag size={14} aria-hidden />
                      <dt className="sr-only">{t('events.ends')}</dt>
                      <dd>{formatDateTime(event.endTime)}</dd>
                    </div>
                  </dl>
                </div>
              </article>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
