import { useState } from 'react';
import { useNavigate } from 'react-router';
import { CheckCircle2, Database, Lock, Play, RotateCcw, Star } from 'lucide-react';
import type { LevelStatus, LevelSummary, StartLevel } from '@quest/shared';
import { api, errorMessage } from '../lib/api';
import { useApi } from '../lib/hooks';
import { useMe } from '../lib/auth';
import { formatNumber } from '../lib/format';
import { PageHeader } from '../components/PageHeader';
import { Empty, ErrorMessage, InlineError, Loading } from '../components/Status';
import { btnPrimary, btnSecondary, btnSmall } from '../components/ui';

const statusStyle: Record<LevelStatus, { label: string; card: string; badge: string; icon: string }> = {
  LOCKED: { label: 'LOCKED', card: 'border-slate-800 bg-slate-900/50', badge: 'border-slate-700 text-slate-500', icon: 'text-slate-600' },
  AVAILABLE: { label: 'AVAILABLE', card: 'border-quantum-800 bg-slate-900', badge: 'border-quantum-700 text-quantum-300', icon: 'text-quantum-400' },
  IN_PROGRESS: { label: 'IN PROGRESS', card: 'border-amber-800/60 bg-amber-950/20', badge: 'border-amber-700 text-amber-300', icon: 'text-amber-400' },
  PLAYED: { label: 'PLAYED', card: 'border-emerald-800/60 bg-emerald-950/20', badge: 'border-emerald-700 text-emerald-300', icon: 'text-emerald-400' },
};

function LevelCard({ level, onStart, busy }: { level: LevelSummary; onStart: (reset: boolean) => void; busy: boolean }) {
  const style = statusStyle[level.status];
  const locked = level.status === 'LOCKED';

  return (
    <article
      className={`relative flex flex-col gap-4 rounded-xl border-2 p-5 transition-all ${style.card} ${
        level.active ? 'ring-2 ring-quantum-400 ring-offset-2 ring-offset-slate-950 shadow-[0_0_25px_rgba(34,211,238,0.2)]' : ''
      }`}
      aria-label={`Level ${level.number}: ${level.title}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg bg-black/40 ${style.icon}`}>
          {locked ? <Lock size={20} aria-hidden /> : <Database size={20} aria-hidden />}
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="font-mono text-xs text-slate-500">LVL {String(level.number).padStart(2, '0')}</span>
          {level.active && <span className="rounded bg-quantum-500 px-1.5 py-0.5 font-mono text-[10px] font-bold text-slate-950">ACTIVE</span>}
        </div>
      </div>

      <div className="flex-1 space-y-2">
        <h2 className={`text-lg font-bold ${locked ? 'text-slate-500' : 'text-white'}`}>{level.title}</h2>
        {level.summary && !locked && <p className="line-clamp-3 text-sm text-slate-400">{level.summary}</p>}
        <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
          <span className="text-slate-400">{formatNumber(level.points)} PTS</span>
          <span className={`rounded border px-1.5 py-0.5 font-bold ${style.badge}`}>{style.label}</span>
          {level.bestScore !== null && (
            <span className="flex items-center gap-1 text-emerald-300">
              <Star size={12} aria-hidden /> best {formatNumber(level.bestScore)}
            </span>
          )}
        </div>
      </div>

      {level.status === 'LOCKED' && (
        <button type="button" disabled className={`${btnSecondary} w-full`}>
          <Lock size={16} aria-hidden /> LOCKED
        </button>
      )}
      {level.status === 'AVAILABLE' && (
        <button type="button" className={`${btnPrimary} w-full`} disabled={busy} onClick={() => onStart(false)}>
          <Play size={16} aria-hidden /> START
        </button>
      )}
      {level.status === 'IN_PROGRESS' && (
        <div className="flex gap-2">
          <button type="button" className={`${btnPrimary} flex-1`} disabled={busy} onClick={() => onStart(false)}>
            <Play size={16} aria-hidden /> RESUME
          </button>
          <button type="button" className={`${btnSecondary} ${btnSmall}`} disabled={busy} onClick={() => onStart(true)} aria-label={`Restart level ${level.number} from the beginning`}>
            <RotateCcw size={14} aria-hidden /> RESTART
          </button>
        </div>
      )}
      {level.status === 'PLAYED' && (
        <button type="button" className={`${btnSecondary} w-full`} disabled={busy} onClick={() => onStart(true)}>
          <CheckCircle2 size={16} aria-hidden /> REPLAY
        </button>
      )}
    </article>
  );
}

export function LevelSelect() {
  const { data, error, loading, reload } = useApi<LevelSummary[]>('/api/levels');
  const { me, refresh } = useMe();
  const navigate = useNavigate();
  const [starting, setStarting] = useState<string | null>(null);
  const [startError, setStartError] = useState<string | null>(null);

  const start = async (level: LevelSummary, reset: boolean) => {
    setStarting(level.id);
    setStartError(null);
    try {
      const body: StartLevel = { reset };
      await api<unknown>(`/api/levels/${encodeURIComponent(level.id)}/start`, { method: 'POST', body });
      await refresh();
      navigate('/play');
    } catch (err) {
      setStartError(`Could not start level ${level.number}: ${errorMessage(err)}`);
      setStarting(null);
    }
  };

  const levels = data ? [...data].sort((a, b) => a.number - b.number) : [];

  return (
    <div className="space-y-8">
      <PageHeader
        title="Level Select"
        subtitle="Pick a level. Starting it makes it your active level, both in the web terminal and over the API."
        actions={
          me && (
            <div className="sm:text-right">
              <p className="text-xs uppercase tracking-widest text-slate-500">Total score</p>
              <p className="font-mono text-2xl font-bold text-quantum-400">{formatNumber(me.totalScore)} PTS</p>
            </div>
          )
        }
      />
      {startError && <InlineError>{startError}</InlineError>}
      {loading && !data ? (
        <Loading label="Loading levels…" />
      ) : error ? (
        <ErrorMessage error={error} onRetry={reload} title="Could not load levels" />
      ) : levels.length === 0 ? (
        <Empty>No levels are published yet.</Empty>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {levels.map((level) => (
            <LevelCard key={level.id} level={level} busy={starting !== null} onStart={(reset) => void start(level, reset)} />
          ))}
        </div>
      )}
    </div>
  );
}
