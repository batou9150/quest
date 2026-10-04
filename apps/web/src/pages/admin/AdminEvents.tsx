import { useState, type FormEvent } from 'react';
import { Pencil, Plus, Trash2, Trophy, X } from 'lucide-react';
import { EventInputSchema, type AdminLevel, type EventSummary } from '@quest/shared';
import { api, errorMessage } from '../../lib/api';
import { useApi } from '../../lib/hooks';
import { formatDateTime, isoToLocalInput, localInputToIso } from '../../lib/format';
import { PageHeader } from '../../components/PageHeader';
import { ConfirmButton } from '../../components/ConfirmButton';
import { EventStatusBadge } from '../../components/EventStatusBadge';
import { Empty, ErrorMessage, InlineError, Loading } from '../../components/Status';
import { btnGhost, btnPrimary, btnSecondary, btnSmall, card, input, label } from '../../components/ui';

function LevelPicker({ selected, onChange }: { selected: string[]; onChange: (ids: string[]) => void }) {
  const { data, error, loading, reload } = useApi<AdminLevel[]>('/api/admin/levels');
  const levels = data ? [...data].sort((a, b) => a.number - b.number) : [];

  return (
    <fieldset className="space-y-2">
      <legend className={label}>Levels counted</legend>
      <p className="text-xs text-slate-500">Leave all unchecked to count every level.</p>
      {loading && !data ? (
        <Loading label="Loading levels…" />
      ) : error ? (
        <ErrorMessage error={error} onRetry={reload} title="Could not load levels" />
      ) : levels.length === 0 ? (
        <p className="text-sm text-slate-500">No levels available.</p>
      ) : (
        <div className="grid max-h-56 gap-1 overflow-y-auto rounded-lg border border-slate-800 bg-slate-950 p-2 sm:grid-cols-2">
          {levels.map((l) => (
            <label key={l.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm text-slate-300 hover:bg-slate-800">
              <input
                type="checkbox"
                className="accent-quantum-500"
                checked={selected.includes(l.id)}
                onChange={(e) => onChange(e.target.checked ? [...selected, l.id] : selected.filter((id) => id !== l.id))}
              />
              <span className="font-mono text-xs text-slate-500">{String(l.number).padStart(2, '0')}</span>
              <span className="truncate">{l.title}</span>
              {!l.published && <span className="font-mono text-[10px] text-amber-400">DRAFT</span>}
            </label>
          ))}
        </div>
      )}
    </fieldset>
  );
}

function EventForm({ event, onSaved, onCancel }: { event: EventSummary | null; onSaved: () => void; onCancel: () => void }) {
  const [title, setTitle] = useState(event?.title ?? '');
  const [shortDescription, setShortDescription] = useState(event?.shortDescription ?? '');
  const [description, setDescription] = useState(event?.description ?? '');
  const [start, setStart] = useState(event ? isoToLocalInput(event.startTime) : '');
  const [end, setEnd] = useState(event ? isoToLocalInput(event.endTime) : '');
  const [levelIds, setLevelIds] = useState<string[]>(event?.levelIds ?? []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const parsed = EventInputSchema.safeParse({
      title,
      shortDescription,
      description,
      startTime: localInputToIso(start),
      endTime: localInputToIso(end),
      levelIds,
    });
    if (!parsed.success) {
      setError(parsed.error.issues.map((i) => `${i.path.join('.') || 'event'}: ${i.message}`).join(' · '));
      return;
    }
    setBusy(true);
    try {
      if (event) await api<unknown>(`/api/admin/events/${encodeURIComponent(event.id)}`, { method: 'PUT', body: parsed.data });
      else await api<unknown>('/api/admin/events', { method: 'POST', body: parsed.data });
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

  return (
    <form onSubmit={submit} className={`${card} space-y-4 p-5`} aria-labelledby="event-form-title">
      <div className="flex items-center justify-between">
        <h2 id="event-form-title" className="font-bold text-white">
          {event ? `Edit “${event.title}”` : 'New event'}
        </h2>
        <button type="button" className={btnGhost} onClick={onCancel} aria-label="Close event form">
          <X size={16} aria-hidden />
        </button>
      </div>
      <div>
        <label htmlFor="ev-title" className={label}>
          Title
        </label>
        <input id="ev-title" className={input} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} required />
      </div>
      <div>
        <label htmlFor="ev-short" className={label}>
          Short description
        </label>
        <input id="ev-short" className={input} value={shortDescription} onChange={(e) => setShortDescription(e.target.value)} maxLength={200} />
      </div>
      <div>
        <label htmlFor="ev-desc" className={label}>
          Description (markdown)
        </label>
        <textarea id="ev-desc" className={`${input} h-32`} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={5000} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="ev-start" className={label}>
            Starts
          </label>
          <input id="ev-start" type="datetime-local" className={input} value={start} onChange={(e) => setStart(e.target.value)} required />
        </div>
        <div>
          <label htmlFor="ev-end" className={label}>
            Ends
          </label>
          <input id="ev-end" type="datetime-local" className={input} value={end} onChange={(e) => setEnd(e.target.value)} required />
        </div>
        <p className="text-xs text-slate-500 sm:col-span-2">Times are in your time zone ({tz}).</p>
      </div>
      <LevelPicker selected={levelIds} onChange={setLevelIds} />
      {error && <InlineError>{error}</InlineError>}
      <div className="flex gap-2">
        <button type="submit" className={btnPrimary} disabled={busy}>
          {busy ? 'Saving…' : event ? 'Save changes' : 'Create event'}
        </button>
        <button type="button" className={btnSecondary} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

export function AdminEvents() {
  const { data, error, loading, reload } = useApi<EventSummary[]>('/api/events');
  const [editing, setEditing] = useState<{ event: EventSummary | null; key: number } | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Events"
        subtitle="Create and schedule competitive events."
        icon={<Trophy className="text-quantum-400" aria-hidden />}
        actions={
          <button type="button" className={btnPrimary} onClick={() => setEditing({ event: null, key: Date.now() })}>
            <Plus size={16} aria-hidden /> New event
          </button>
        }
      />

      {editing && (
        <EventForm
          key={editing.key}
          event={editing.event}
          onCancel={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            reload();
          }}
        />
      )}
      {rowError && <InlineError>{rowError}</InlineError>}

      {loading && !data ? (
        <Loading label="Loading events…" />
      ) : error ? (
        <ErrorMessage error={error} onRetry={reload} title="Could not load events" />
      ) : !data || data.length === 0 ? (
        <Empty>No events yet.</Empty>
      ) : (
        <ul className="space-y-3">
          {data.map((ev) => (
            <li key={ev.id} className={`${card} flex flex-col gap-3 p-4 sm:flex-row sm:items-center`}>
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <EventStatusBadge status={ev.status} />
                  <p className="font-bold text-white">{ev.title}</p>
                </div>
                <p className="font-mono text-xs text-slate-500">
                  {formatDateTime(ev.startTime)} → {formatDateTime(ev.endTime)} · {ev.levelIds.length === 0 ? 'all levels' : `${ev.levelIds.length} level(s)`}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" className={`${btnSecondary} ${btnSmall}`} onClick={() => setEditing({ event: ev, key: Date.now() })}>
                  <Pencil size={14} aria-hidden /> Edit
                </button>
                <ConfirmButton
                  small
                  ariaLabel={`Delete event ${ev.title}`}
                  prompt="Delete this event?"
                  confirmLabel="Delete"
                  onConfirm={async () => {
                    setRowError(null);
                    try {
                      await api<void>(`/api/admin/events/${encodeURIComponent(ev.id)}`, { method: 'DELETE' });
                      if (editing?.event?.id === ev.id) setEditing(null);
                      reload();
                    } catch (err) {
                      setRowError(`Could not delete "${ev.title}": ${errorMessage(err)}`);
                    }
                  }}
                >
                  <Trash2 size={14} aria-hidden /> Delete
                </ConfirmButton>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
