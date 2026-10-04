import { useState, type ChangeEvent } from 'react';
import { Eye, EyeOff, FileJson, Layers, Network, Pencil, Trash2, Upload, X } from 'lucide-react';
import type { AdminLevel, AdminLevelPatch } from '@quest/shared';
import { api, ApiError, errorMessage } from '../../lib/api';
import { useApi } from '../../lib/hooks';
import { formatDateTime } from '../../lib/format';
import { PageHeader } from '../../components/PageHeader';
import { ActionMenu } from '../../components/ActionMenu';
import { Empty, ErrorMessage, InlineError, Loading } from '../../components/Status';
import { btnDanger, btnGhost, btnPrimary, btnSecondary, btnSmall, card, input, label } from '../../components/ui';

function UploadPanel({ initial, onUploaded, onClose }: { initial: string; onUploaded: () => void; onClose: () => void }) {
  const [text, setText] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [issues, setIssues] = useState<string[]>([]);
  const [success, setSuccess] = useState<string | null>(null);

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setText(await file.text());
    setSuccess(null);
  };

  const upload = async () => {
    setError(null);
    setIssues([]);
    setSuccess(null);
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch (err) {
      setError(`Invalid JSON: ${errorMessage(err)}`);
      return;
    }
    if (typeof json !== 'object' || json === null || Array.isArray(json)) {
      setError('The level must be a JSON object.');
      return;
    }
    const id = (json as Record<string, unknown>).id;
    if (typeof id !== 'string' || !id) {
      setError('The level JSON needs a string "id" field.');
      return;
    }
    // GET /api/admin/levels/:id adds `published`, which is not part of the level schema.
    const { published: _published, ...level } = json as Record<string, unknown>;
    setBusy(true);
    try {
      await api<unknown>(`/api/admin/levels/${encodeURIComponent(id)}`, { method: 'PUT', body: level });
      setSuccess(`Level "${id}" saved.`);
      onUploaded();
    } catch (err) {
      setError(errorMessage(err));
      if (err instanceof ApiError) setIssues(err.issues);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className={`${card} space-y-4 p-5`} aria-labelledby="upload-title">
      <div className="flex items-center justify-between">
        <h2 id="upload-title" className="font-bold text-white">
          Upload level
        </h2>
        <button type="button" className={btnGhost} onClick={onClose} aria-label="Close upload panel">
          <X size={16} aria-hidden />
        </button>
      </div>
      <p className="text-sm text-slate-400">
        Paste a level JSON or pick a file. It is saved under the JSON's <code className="font-mono text-slate-300">id</code> (created or
        replaced).
      </p>
      <div>
        <label htmlFor="level-file" className={label}>
          JSON file
        </label>
        <input id="level-file" type="file" accept=".json,application/json" onChange={onFile} className="block text-sm text-slate-400 file:mr-3 file:rounded file:border-0 file:bg-slate-800 file:px-3 file:py-1.5 file:text-slate-200" />
      </div>
      <div>
        <label htmlFor="level-json" className={label}>
          Level JSON
        </label>
        <textarea id="level-json" className={`${input} h-80 font-mono text-xs`} value={text} onChange={(e) => setText(e.target.value)} spellCheck={false} />
      </div>
      {error && (
        <div role="alert" className="space-y-2 rounded-lg border border-red-900/60 bg-red-950/30 p-3 text-sm">
          <p className="font-bold text-red-300">{error}</p>
          {issues.length > 0 && (
            <ul className="list-disc space-y-1 pl-5 font-mono text-xs text-red-200/90">
              {issues.map((issue, i) => (
                <li key={i}>{issue}</li>
              ))}
            </ul>
          )}
        </div>
      )}
      {success && <p className="text-sm text-emerald-400" role="status">{success}</p>}
      <button type="button" className={btnPrimary} onClick={upload} disabled={busy || !text.trim()}>
        <Upload size={16} aria-hidden /> {busy ? 'Uploading…' : 'Upload'}
      </button>
    </section>
  );
}

function LevelJson({ id, onEdit, onClose }: { id: string; onEdit: (json: string) => void; onClose: () => void }) {
  const { data, error, loading, reload } = useApi<unknown>(`/api/admin/levels/${encodeURIComponent(id)}`);
  const json = data === undefined ? '' : JSON.stringify(data, null, 2);
  return (
    <section className={`${card} space-y-3 p-5`} aria-label={`JSON of level ${id}`}>
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-mono font-bold text-white">{id}.json</h2>
        <div className="flex gap-2">
          {json && (
            <button type="button" className={`${btnSecondary} ${btnSmall}`} onClick={() => onEdit(json)}>
              <Pencil size={14} aria-hidden /> Edit in uploader
            </button>
          )}
          <button type="button" className={btnGhost} onClick={onClose} aria-label="Close JSON view">
            <X size={16} aria-hidden />
          </button>
        </div>
      </div>
      {loading && data === undefined ? (
        <Loading label="Loading level…" />
      ) : error ? (
        <ErrorMessage error={error} onRetry={reload} />
      ) : (
        <pre className="max-h-[32rem] overflow-auto rounded-lg border border-slate-800 bg-slate-950 p-4 font-mono text-xs text-emerald-300">{json}</pre>
      )}
    </section>
  );
}

function LevelRow({ level, onChanged, onView }: { level: AdminLevel; onChanged: () => void; onView: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const deleteLevel = async () => {
    setBusy(true);
    setError(null);
    try {
      await api<void>(`/api/admin/levels/${encodeURIComponent(level.id)}`, { method: 'DELETE' });
      onChanged();
    } catch (err) {
      setError(errorMessage(err));
      setConfirmingDelete(false);
    } finally {
      setBusy(false);
    }
  };

  const togglePublished = async () => {
    setBusy(true);
    setError(null);
    try {
      const body: AdminLevelPatch = { published: !level.published };
      await api<unknown>(`/api/admin/levels/${encodeURIComponent(level.id)}`, { method: 'PATCH', body });
      onChanged();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <tr className="align-top">
      <td className="px-4 py-3 font-mono text-slate-500">{String(level.number).padStart(2, '0')}</td>
      <td className="px-4 py-3">
        <p className="font-bold text-slate-200">{level.title}</p>
        <p className="font-mono text-xs text-slate-500">{level.id}</p>
        <p className="text-xs text-slate-600">updated {formatDateTime(level.updatedAt)}</p>
      </td>
      <td className="px-4 py-3 font-mono text-xs text-slate-400">
        {level.points} pts · par {level.par}
      </td>
      <td className="px-4 py-3">
        <button
          type="button"
          role="switch"
          aria-checked={level.published}
          aria-label={`Published: ${level.title}`}
          disabled={busy}
          onClick={togglePublished}
          className={`${btnSmall} inline-flex items-center gap-1 rounded-full border font-bold ${
            level.published ? 'border-emerald-700 bg-emerald-950/60 text-emerald-300' : 'border-slate-700 bg-slate-800 text-slate-400'
          }`}
        >
          {level.published ? <Eye size={12} aria-hidden /> : <EyeOff size={12} aria-hidden />}
          {level.published ? 'Published' : 'Draft'}
        </button>
      </td>
      <td className="px-4 py-3 text-right">
        {confirmingDelete ? (
          <span className="inline-flex flex-wrap items-center justify-end gap-2" role="group" aria-label={`Delete level ${level.title}?`}>
            <span className="text-xs text-amber-300">Delete this level?</span>
            <button type="button" className={`${btnDanger} ${btnSmall}`} disabled={busy} onClick={deleteLevel}>
              {busy ? 'Deleting…' : 'Delete'}
            </button>
            <button type="button" className={`${btnGhost} ${btnSmall}`} disabled={busy} onClick={() => setConfirmingDelete(false)}>
              Cancel
            </button>
          </span>
        ) : (
          <ActionMenu
            label={`Actions for ${level.title}`}
            items={[
              { label: 'Preview', icon: <Network size={15} aria-hidden />, to: `/admin/levels/${encodeURIComponent(level.id)}/preview` },
              { label: 'View JSON', icon: <FileJson size={15} aria-hidden />, onSelect: onView },
              { label: 'Delete…', icon: <Trash2 size={15} aria-hidden />, danger: true, onSelect: () => setConfirmingDelete(true) },
            ]}
          />
        )}
        {error && <InlineError>{error}</InlineError>}
      </td>
    </tr>
  );
}

export function AdminLevels() {
  const { data, error, loading, reload } = useApi<AdminLevel[]>('/api/admin/levels');
  const [uploader, setUploader] = useState<{ initial: string; key: number } | null>(null);
  const [viewing, setViewing] = useState<string | null>(null);

  const openUploader = (initial = '') => {
    setUploader({ initial, key: Date.now() });
    setViewing(null);
  };

  const levels = data ? [...data].sort((a, b) => a.number - b.number) : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Levels"
        subtitle="Upload, publish and remove levels."
        icon={<Layers className="text-quantum-400" aria-hidden />}
        actions={
          <button type="button" className={btnPrimary} onClick={() => openUploader()}>
            <Upload size={16} aria-hidden /> Upload level
          </button>
        }
      />

      {uploader && <UploadPanel key={uploader.key} initial={uploader.initial} onUploaded={reload} onClose={() => setUploader(null)} />}
      {viewing && <LevelJson key={viewing} id={viewing} onEdit={(json) => openUploader(json)} onClose={() => setViewing(null)} />}

      {loading && !data ? (
        <Loading label="Loading levels…" />
      ) : error ? (
        <ErrorMessage error={error} onRetry={reload} title="Could not load levels" />
      ) : levels.length === 0 ? (
        <Empty>No levels yet. Upload one to get started.</Empty>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900">
          <table className="w-full min-w-[36rem] text-left text-sm">
            <thead className="bg-slate-950 font-mono text-xs uppercase text-slate-400">
              <tr>
                <th scope="col" className="px-4 py-3">#</th>
                <th scope="col" className="px-4 py-3">Level</th>
                <th scope="col" className="px-4 py-3">Scoring</th>
                <th scope="col" className="px-4 py-3">Status</th>
                <th scope="col" className="px-4 py-3 text-right">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {levels.map((level) => (
                <LevelRow
                  key={level.id}
                  level={level}
                  onChanged={reload}
                  onView={() => {
                    setViewing(level.id);
                    setUploader(null);
                  }}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
