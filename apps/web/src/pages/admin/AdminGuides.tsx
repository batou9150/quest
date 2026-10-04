import { useState, type FormEvent } from 'react';
import { BookOpen, ExternalLink, Pencil, Plus, Trash2, X } from 'lucide-react';
import { Link } from 'react-router';
import { GuideInputSchema, SLUG_PATTERN, type Guide } from '@quest/shared';
import { api, errorMessage } from '../../lib/api';
import { useApi } from '../../lib/hooks';
import { formatDate } from '../../lib/format';
import { PageHeader } from '../../components/PageHeader';
import { ConfirmButton } from '../../components/ConfirmButton';
import { Markdown } from '../../components/Markdown';
import { Empty, ErrorMessage, InlineError, Loading } from '../../components/Status';
import { btnGhost, btnPrimary, btnSecondary, btnSmall, card, input, label } from '../../components/ui';

function GuideForm({ guide, onSaved, onCancel }: { guide: Guide | null; onSaved: () => void; onCancel: () => void }) {
  const creating = guide === null;
  const [slug, setSlug] = useState(guide?.slug ?? '');
  const [title, setTitle] = useState(guide?.title ?? '');
  const [category, setCategory] = useState(guide?.category ?? '');
  const [summary, setSummary] = useState(guide?.summary ?? '');
  const [imageUrl, setImageUrl] = useState(guide?.imageUrl ?? '');
  const [content, setContent] = useState(guide?.content ?? '');
  const [published, setPublished] = useState(guide?.published ?? false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!SLUG_PATTERN.test(slug)) {
      setError('Slug: lowercase letters, digits and single dashes only (e.g. "getting-started").');
      return;
    }
    const parsed = GuideInputSchema.safeParse({ title, category, summary, imageUrl: imageUrl.trim() || null, content, published });
    if (!parsed.success) {
      setError(parsed.error.issues.map((i) => `${i.path.join('.') || 'guide'}: ${i.message}`).join(' · '));
      return;
    }
    setBusy(true);
    try {
      await api<unknown>(`/api/admin/guides/${encodeURIComponent(slug)}`, { method: 'PUT', body: parsed.data });
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className={`${card} space-y-4 p-5`} aria-labelledby="guide-form-title">
      <div className="flex items-center justify-between">
        <h2 id="guide-form-title" className="font-bold text-white">
          {creating ? 'New guide' : `Edit “${guide.title}”`}
        </h2>
        <button type="button" className={btnGhost} onClick={onCancel} aria-label="Close guide form">
          <X size={16} aria-hidden />
        </button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="g-slug" className={label}>
            Slug
          </label>
          <input
            id="g-slug"
            className={`${input} font-mono`}
            value={slug}
            onChange={(e) => setSlug(e.target.value.toLowerCase())}
            readOnly={!creating}
            disabled={!creating}
            required
            placeholder="getting-started"
            aria-describedby="g-slug-help"
          />
          <p id="g-slug-help" className="mt-1 text-xs text-slate-500">
            {creating ? `URL: /guides/${slug || '…'}` : 'The slug cannot be changed.'}
          </p>
        </div>
        <div>
          <label htmlFor="g-category" className={label}>
            Category
          </label>
          <input id="g-category" className={input} value={category} onChange={(e) => setCategory(e.target.value)} maxLength={40} required />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="g-title" className={label}>
            Title
          </label>
          <input id="g-title" className={input} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} required />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="g-summary" className={label}>
            Summary
          </label>
          <input id="g-summary" className={input} value={summary} onChange={(e) => setSummary(e.target.value)} maxLength={300} />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="g-image" className={label}>
            Image URL (optional)
          </label>
          <input id="g-image" type="url" className={input} value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://…" />
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <label htmlFor="g-content" className={label}>
            Content (markdown)
          </label>
          <textarea id="g-content" className={`${input} h-96 font-mono text-xs`} value={content} onChange={(e) => setContent(e.target.value)} spellCheck={false} />
        </div>
        <div>
          <p className={label} id="g-preview-label">
            Preview
          </p>
          <div aria-labelledby="g-preview-label" className="h-96 overflow-y-auto rounded-lg border border-slate-800 bg-slate-950/60 p-4">
            {content.trim() ? <Markdown>{content}</Markdown> : <p className="text-sm text-slate-600">Nothing to preview yet.</p>}
          </div>
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm text-slate-300">
        <input type="checkbox" className="accent-quantum-500" checked={published} onChange={(e) => setPublished(e.target.checked)} />
        Published
      </label>
      {error && <InlineError>{error}</InlineError>}
      <div className="flex gap-2">
        <button type="submit" className={btnPrimary} disabled={busy}>
          {busy ? 'Saving…' : creating ? 'Create guide' : 'Save changes'}
        </button>
        <button type="button" className={btnSecondary} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

/** Loads the full guide (the list omits content) before showing the form. */
function EditGuide({ slug, onSaved, onCancel }: { slug: string; onSaved: () => void; onCancel: () => void }) {
  const { data, error, loading, reload } = useApi<Guide>(`/api/guides/${encodeURIComponent(slug)}`);
  if (loading && !data) return <Loading label="Loading guide…" />;
  if (error || !data) return <ErrorMessage error={error} onRetry={reload} title="Could not load this guide" />;
  return <GuideForm guide={data} onSaved={onSaved} onCancel={onCancel} />;
}

export function AdminGuides() {
  const { data, error, loading, reload } = useApi<Guide[]>('/api/admin/guides');
  const [editing, setEditing] = useState<{ slug: string | null; key: number } | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);

  const close = () => setEditing(null);
  const saved = () => {
    setEditing(null);
    reload();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Guides"
        subtitle="Write and publish guides."
        icon={<BookOpen className="text-quantum-400" aria-hidden />}
        actions={
          <button type="button" className={btnPrimary} onClick={() => setEditing({ slug: null, key: Date.now() })}>
            <Plus size={16} aria-hidden /> New guide
          </button>
        }
      />

      {editing &&
        (editing.slug === null ? (
          <GuideForm key={editing.key} guide={null} onSaved={saved} onCancel={close} />
        ) : (
          <EditGuide key={editing.key} slug={editing.slug} onSaved={saved} onCancel={close} />
        ))}
      {rowError && <InlineError>{rowError}</InlineError>}

      {loading && !data ? (
        <Loading label="Loading guides…" />
      ) : error ? (
        <ErrorMessage error={error} onRetry={reload} title="Could not load guides" />
      ) : !data || data.length === 0 ? (
        <Empty>No guides yet.</Empty>
      ) : (
        <ul className="space-y-3">
          {data.map((g) => (
            <li key={g.slug} className={`${card} flex flex-col gap-3 p-4 sm:flex-row sm:items-center`}>
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded border px-2 py-0.5 font-mono text-xs font-bold ${g.published ? 'border-emerald-700 text-emerald-300' : 'border-amber-700 text-amber-300'}`}>
                    {g.published ? 'PUBLISHED' : 'DRAFT'}
                  </span>
                  <p className="font-bold text-white">{g.title}</p>
                </div>
                <p className="font-mono text-xs text-slate-500">
                  /{g.slug} · {g.category} · {g.author} · {formatDate(g.publishedAt)}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link to={`/guides/${g.slug}`} className={`${btnGhost} ${btnSmall}`} aria-label={`View guide ${g.title}`}>
                  <ExternalLink size={14} aria-hidden /> View
                </Link>
                <button type="button" className={`${btnSecondary} ${btnSmall}`} onClick={() => setEditing({ slug: g.slug, key: Date.now() })}>
                  <Pencil size={14} aria-hidden /> Edit
                </button>
                <ConfirmButton
                  small
                  ariaLabel={`Delete guide ${g.title}`}
                  prompt="Delete this guide?"
                  confirmLabel="Delete"
                  onConfirm={async () => {
                    setRowError(null);
                    try {
                      await api<void>(`/api/admin/guides/${encodeURIComponent(g.slug)}`, { method: 'DELETE' });
                      if (editing?.slug === g.slug) setEditing(null);
                      reload();
                    } catch (err) {
                      setRowError(`Could not delete "${g.title}": ${errorMessage(err)}`);
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
