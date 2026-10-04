import { useCallback, useState } from 'react';
import { Link, useParams } from 'react-router';
import { ChevronLeft, Trophy } from 'lucide-react';
import type { EventSummary, LeaderboardEntry } from '@quest/shared';
import { api, ApiError, errorMessage } from '../lib/api';
import { useApi, useVisiblePolling } from '../lib/hooks';
import { useMe } from '../lib/auth';
import { formatDateTime, formatNumber } from '../lib/format';
import { Empty, ErrorMessage, Loading } from '../components/Status';
import { EventStatusBadge } from '../components/EventStatusBadge';
import { Markdown } from '../components/Markdown';
import { NotFound } from './NotFound';

const POLL_MS = 15_000;

function Leaderboard({ eventId, live }: { eventId: string; live: boolean }) {
  const path = `/api/events/${encodeURIComponent(eventId)}/leaderboard`;
  const { data, error, loading, reload, setData } = useApi<LeaderboardEntry[]>(path);
  const [pollError, setPollError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const { me } = useMe();

  const poll = useCallback(() => {
    api<LeaderboardEntry[]>(path)
      .then((rows) => {
        setData(rows);
        setPollError(null);
        setUpdatedAt(new Date());
      })
      .catch((err: unknown) => setPollError(errorMessage(err)));
  }, [path, setData]);

  useVisiblePolling(poll, POLL_MS, live && data !== undefined);

  return (
    <section className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900" aria-labelledby="leaderboard-title">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 p-5">
        <h2 id="leaderboard-title" className="flex items-center gap-2 text-xl font-bold text-white">
          <Trophy size={20} className="text-amber-400" aria-hidden /> Leaderboard
        </h2>
        <span className="font-mono text-xs text-slate-500" aria-live="polite">
          {pollError
            ? `Refresh failed: ${pollError}`
            : live
              ? `Refreshes every 15 s${updatedAt ? ` · updated ${updatedAt.toLocaleTimeString()}` : ''}`
              : 'Final standings'}
        </span>
      </div>
      {loading && !data ? (
        <Loading label="Loading leaderboard…" />
      ) : error ? (
        <div className="p-5">
          <ErrorMessage error={error} onRetry={reload} title="Could not load the leaderboard" />
        </div>
      ) : !data || data.length === 0 ? (
        <div className="p-5">
          <Empty>No scores yet.</Empty>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-950 font-mono text-xs uppercase text-slate-400">
              <tr>
                <th scope="col" className="px-5 py-3">Rank</th>
                <th scope="col" className="px-5 py-3">Name</th>
                <th scope="col" className="px-5 py-3 text-right">Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {data.map((entry) => {
                const mine = me?.id === entry.userId;
                return (
                  <tr key={entry.userId} className={mine ? 'bg-quantum-500/10' : 'hover:bg-slate-800/50'}>
                    <td className={`px-5 py-3 font-mono ${entry.rank <= 3 ? 'font-bold text-amber-300' : 'text-slate-400'}`}>#{entry.rank}</td>
                    <td className="px-5 py-3 font-bold text-slate-200">
                      {entry.displayName}
                      {mine && <span className="ml-2 font-mono text-xs text-quantum-400">(you)</span>}
                    </td>
                    <td className="px-5 py-3 text-right font-mono text-quantum-400">{formatNumber(entry.score)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export function EventDetail() {
  const { id = '' } = useParams();
  const { data: event, error, loading, reload } = useApi<EventSummary>(`/api/events/${encodeURIComponent(id)}`);

  if (loading && !event) return <Loading label="Loading event…" />;
  if (error instanceof ApiError && error.status === 404) return <NotFound />;
  if (error || !event) return <ErrorMessage error={error} onRetry={reload} title="Could not load this event" />;

  return (
    <div className="space-y-8">
      <Link to="/events" className="inline-flex items-center text-sm text-slate-400 transition-colors hover:text-white">
        <ChevronLeft size={16} className="mr-1" aria-hidden /> Back to Events
      </Link>

      <section className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/50 p-6 sm:p-8">
        <h1 className="text-3xl font-bold text-white sm:text-4xl">{event.title}</h1>
        <div className="flex flex-wrap items-center gap-3 font-mono text-sm text-slate-400">
          <EventStatusBadge status={event.status} />
          <span className="rounded bg-slate-800 px-2 py-1">
            {formatDateTime(event.startTime)} → {formatDateTime(event.endTime)}
          </span>
        </div>
        {event.description ? <Markdown>{event.description}</Markdown> : event.shortDescription && <p className="text-slate-300">{event.shortDescription}</p>}
        {event.status === 'ACTIVE' && (
          <p className="text-sm text-slate-400">
            Scores from {event.levelIds.length === 0 ? 'all levels' : `${event.levelIds.length} level${event.levelIds.length > 1 ? 's' : ''}`} count
            while the event runs. Head to{' '}
            <Link to="/level-select" className="text-quantum-400 hover:underline">
              Level Select
            </Link>{' '}
            to play.
          </p>
        )}
      </section>

      <Leaderboard eventId={event.id} live={event.status !== 'COMPLETED'} />
    </div>
  );
}
