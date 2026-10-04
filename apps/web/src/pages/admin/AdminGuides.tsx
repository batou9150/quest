import { useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { BookOpen, ExternalLink, Languages, Pencil, Plus, Trash2, X } from 'lucide-react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { GuideInputSchema, LANGS, SLUG_PATTERN, type AdminGuide, type Guide, type GuideInput, type GuideText, type Lang } from '@quest/shared';
import { api, errorMessage } from '../../lib/api';
import { useApi } from '../../lib/hooks';
import { formatDate } from '../../lib/format';
import { formatIssues } from '../../lib/issues';
import { PageHeader } from '../../components/PageHeader';
import { ConfirmButton } from '../../components/ConfirmButton';
import { Markdown } from '../../components/Markdown';
import { Empty, ErrorMessage, InlineError, Loading } from '../../components/Status';
import { btnGhost, btnPrimary, btnSecondary, btnSmall, card, input, label } from '../../components/ui';

/** English is required; the other languages are optional translations (readers fall back to English). */
type OptionalLang = Exclude<Lang, 'en'>;
const isOptional = (lang: Lang): lang is OptionalLang => lang !== 'en';

type Texts = AdminGuide['locales'];
const EMPTY_TEXT: GuideText = { title: '', category: '', summary: '', content: '' };
const TEXT_FIELDS = ['title', 'category', 'summary', 'content'] as const;

/** Title, category, summary and markdown content (with live preview) of one language. */
function TextFields({ lang, text, onChange }: { lang: Lang; text: GuideText; onChange: (text: GuideText) => void }) {
  const { t } = useTranslation();
  const set = (field: keyof GuideText) => (value: string) => onChange({ ...text, [field]: value });
  const id = (field: string) => `g-${lang}-${field}`;
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor={id('title')} className={label}>
            {t('adminGuides.fieldTitle')}
          </label>
          <input id={id('title')} lang={lang} className={input} value={text.title} onChange={(e) => set('title')(e.target.value)} maxLength={120} required />
        </div>
        <div>
          <label htmlFor={id('category')} className={label}>
            {t('adminGuides.fieldCategory')}
          </label>
          <input id={id('category')} lang={lang} className={input} value={text.category} onChange={(e) => set('category')(e.target.value)} maxLength={40} required />
        </div>
        <div>
          <label htmlFor={id('summary')} className={label}>
            {t('adminGuides.fieldSummary')}
          </label>
          <input id={id('summary')} lang={lang} className={input} value={text.summary} onChange={(e) => set('summary')(e.target.value)} maxLength={300} />
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <label htmlFor={id('content')} className={label}>
            {t('adminGuides.fieldContent')}
          </label>
          <textarea
            id={id('content')}
            lang={lang}
            className={`${input} h-96 font-mono text-xs`}
            value={text.content}
            onChange={(e) => set('content')(e.target.value)}
            spellCheck={false}
          />
        </div>
        <div>
          <p className={label} id={id('preview-label')}>
            {t('adminGuides.preview')}
          </p>
          <div lang={lang} aria-labelledby={id('preview-label')} className="h-96 overflow-y-auto rounded-lg border border-slate-800 bg-slate-950/60 p-4">
            {text.content.trim() ? <Markdown>{text.content}</Markdown> : <p className="text-sm text-slate-600">{t('adminGuides.nothingToPreview')}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

function GuideForm({ guide, onSaved, onCancel }: { guide: AdminGuide | null; onSaved: () => void; onCancel: () => void }) {
  const { t } = useTranslation();
  const creating = guide === null;
  const [slug, setSlug] = useState(guide?.slug ?? '');
  const [imageUrl, setImageUrl] = useState(guide?.imageUrl ?? '');
  const [published, setPublished] = useState(guide?.published ?? false);
  const [texts, setTexts] = useState<Texts>(guide?.locales ?? { en: EMPTY_TEXT });
  const [tab, setTab] = useState<Lang>('en');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tabs = useRef<Partial<Record<Lang, HTMLButtonElement | null>>>({});

  const setText = (lang: Lang, text: GuideText) => setTexts((current) => ({ ...current, [lang]: text }));

  const addLanguage = (lang: OptionalLang) => {
    // Start from the English texts: translating in place keeps the markdown structure (code blocks, links...).
    setTexts((current) => ({ ...current, [lang]: { ...current.en } }));
    setTab(lang);
  };

  const removeLanguage = (lang: OptionalLang) => {
    setTexts((current) => {
      const next = { ...current };
      delete next[lang];
      return next;
    });
    setTab('en');
  };

  const onTabKey = (e: KeyboardEvent) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const index = LANGS.indexOf(tab) + (e.key === 'ArrowRight' ? 1 : -1);
    const next = LANGS[(index + LANGS.length) % LANGS.length]!;
    setTab(next);
    tabs.current[next]?.focus();
  };

  const fieldName = (path: readonly PropertyKey[]): string | undefined => {
    const [first, lang, field] = path;
    if (first === 'imageUrl') return t('adminGuides.fieldImageUrl');
    if (first === 'published') return t('adminGuides.fieldPublished');
    if (first !== 'locales' || typeof lang !== 'string' || !(LANGS as readonly string[]).includes(lang)) return undefined;
    const fieldLabels: Record<(typeof TEXT_FIELDS)[number], string> = {
      title: t('adminGuides.fieldTitle'),
      category: t('adminGuides.fieldCategory'),
      summary: t('adminGuides.fieldSummary'),
      content: t('adminGuides.fieldContent'),
    };
    const language = t(`lang.${lang as Lang}`);
    return TEXT_FIELDS.includes(field as never) ? `${language} · ${fieldLabels[field as (typeof TEXT_FIELDS)[number]]}` : language;
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!SLUG_PATTERN.test(slug)) {
      setError(t('adminGuides.slugInvalid'));
      return;
    }
    const body: GuideInput = { imageUrl: imageUrl.trim() || null, published, locales: texts };
    const parsed = GuideInputSchema.safeParse(body);
    if (!parsed.success) {
      // Show the tab holding the first invalid field.
      const [first, lang] = parsed.error.issues[0]?.path ?? [];
      if (first === 'locales' && typeof lang === 'string' && (LANGS as readonly string[]).includes(lang)) setTab(lang as Lang);
      setError(formatIssues(parsed.error.issues, fieldName));
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

  const current = texts[tab];

  return (
    <form onSubmit={submit} className={`${card} space-y-4 p-5`} aria-labelledby="guide-form-title">
      <div className="flex items-center justify-between">
        <h2 id="guide-form-title" className="font-bold text-white">
          {creating ? t('adminGuides.new') : t('adminGuides.editTitle', { title: guide.locales.en.title })}
        </h2>
        <button type="button" className={btnGhost} onClick={onCancel} aria-label={t('adminGuides.closeForm')}>
          <X size={16} aria-hidden />
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="g-slug" className={label}>
            {t('adminGuides.slug')}
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
            {creating ? t('adminGuides.slugUrl', { slug: slug || '…' }) : t('adminGuides.slugFixed')}
          </p>
        </div>
        <div>
          <label htmlFor="g-image" className={label}>
            {t('adminGuides.imageUrl')}
          </label>
          <input id="g-image" type="url" className={input} value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://…" />
        </div>
      </div>

      <div>
        <div role="tablist" aria-label={t('adminGuides.tabs')} className="flex flex-wrap gap-1 border-b border-slate-800" onKeyDown={onTabKey}>
          {LANGS.map((lang) => {
            const selected = tab === lang;
            return (
              <button
                key={lang}
                ref={(el) => {
                  tabs.current[lang] = el;
                }}
                type="button"
                role="tab"
                id={`g-tab-${lang}`}
                aria-selected={selected}
                aria-controls={`g-panel-${lang}`}
                tabIndex={selected ? 0 : -1}
                onClick={() => setTab(lang)}
                className={`-mb-px flex items-center gap-2 border-b-2 px-3 py-2 text-sm font-bold transition-colors ${
                  selected ? 'border-quantum-500 text-quantum-300' : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <span className="font-mono text-xs uppercase">{lang}</span>
                {t(`lang.${lang}`)}
                <span className="text-xs font-normal text-slate-500">
                  {lang === 'en' ? `(${t('adminGuides.required')})` : texts[lang] ? '' : `(${t('adminGuides.missing')})`}
                </span>
              </button>
            );
          })}
        </div>
        <div role="tabpanel" id={`g-panel-${tab}`} aria-labelledby={`g-tab-${tab}`} className="pt-4">
          {current ? (
            <div className="space-y-3">
              {isOptional(tab) && (
                <div className="flex justify-end">
                  <ConfirmButton
                    small
                    prompt={t(`adminGuides.optional.${tab}.removePrompt`)}
                    confirmLabel={t('adminGuides.remove')}
                    onConfirm={() => removeLanguage(tab)}
                  >
                    <Trash2 size={14} aria-hidden /> {t(`adminGuides.optional.${tab}.remove`)}
                  </ConfirmButton>
                </div>
              )}
              <TextFields lang={tab} text={current} onChange={(text) => setText(tab, text)} />
            </div>
          ) : (
            isOptional(tab) && (
              <div className="space-y-3 rounded-lg border border-dashed border-slate-700 p-5 text-sm text-slate-400">
                <p>{t(`adminGuides.optional.${tab}.none`)}</p>
                <p>{t(`adminGuides.optional.${tab}.addHelp`)}</p>
                <button type="button" className={btnSecondary} onClick={() => addLanguage(tab)}>
                  <Languages size={16} aria-hidden /> {t(`adminGuides.optional.${tab}.add`)}
                </button>
              </div>
            )
          )}
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-slate-300">
        <input type="checkbox" className="accent-quantum-500" checked={published} onChange={(e) => setPublished(e.target.checked)} />
        {t('adminGuides.published')}
      </label>
      {error && <InlineError>{error}</InlineError>}
      <div className="flex gap-2">
        <button type="submit" className={btnPrimary} disabled={busy}>
          {busy ? t('common.saving') : creating ? t('adminGuides.create') : t('common.saveChanges')}
        </button>
        <button type="button" className={btnSecondary} onClick={onCancel}>
          {t('common.cancel')}
        </button>
      </div>
    </form>
  );
}

/** Loads every language of the guide before showing the form. */
function EditGuide({ slug, onSaved, onCancel }: { slug: string; onSaved: () => void; onCancel: () => void }) {
  const { t } = useTranslation();
  const { data, error, loading, reload } = useApi<AdminGuide>(`/api/admin/guides/${encodeURIComponent(slug)}`);
  if (loading && !data) return <Loading label={t('adminGuides.loadingGuide')} />;
  if (error || !data) return <ErrorMessage error={error} onRetry={reload} title={t('adminGuides.loadGuideError')} />;
  return <GuideForm guide={data} onSaved={onSaved} onCancel={onCancel} />;
}

export function AdminGuides() {
  const { t } = useTranslation();
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
        title={t('adminGuides.title')}
        subtitle={t('adminGuides.subtitle')}
        icon={<BookOpen className="text-quantum-400" aria-hidden />}
        actions={
          <button type="button" className={btnPrimary} onClick={() => setEditing({ slug: null, key: Date.now() })}>
            <Plus size={16} aria-hidden /> {t('adminGuides.new')}
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
        <Loading label={t('adminGuides.loading')} />
      ) : error ? (
        <ErrorMessage error={error} onRetry={reload} title={t('adminGuides.loadError')} />
      ) : !data || data.length === 0 ? (
        <Empty>{t('adminGuides.empty')}</Empty>
      ) : (
        <ul className="space-y-3">
          {data.map((g) => (
            <li key={g.slug} className={`${card} flex flex-col gap-3 p-4 sm:flex-row sm:items-center`}>
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded border px-2 py-0.5 font-mono text-xs font-bold ${g.published ? 'border-emerald-700 text-emerald-300' : 'border-amber-700 text-amber-300'}`}>
                    {g.published ? t('common.published') : t('common.draft')}
                  </span>
                  <p className="font-bold text-white">{g.title}</p>
                  <span className="flex gap-1" aria-label={t('adminGuides.languages')} role="group">
                    {(g.languages ?? [g.lang]).map((l) => (
                      <span key={l} title={t(`lang.${l}`)} className="rounded border border-slate-700 px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase text-slate-400">
                        {l}
                      </span>
                    ))}
                  </span>
                </div>
                <p className="font-mono text-xs text-slate-500">
                  /{g.slug} · {g.category} · {g.author} · {formatDate(g.publishedAt)}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link to={`/guides/${g.slug}`} className={`${btnGhost} ${btnSmall}`} aria-label={t('adminGuides.viewLabel', { title: g.title })}>
                  <ExternalLink size={14} aria-hidden /> {t('common.view')}
                </Link>
                <button type="button" className={`${btnSecondary} ${btnSmall}`} onClick={() => setEditing({ slug: g.slug, key: Date.now() })}>
                  <Pencil size={14} aria-hidden /> {t('common.edit')}
                </button>
                <ConfirmButton
                  small
                  ariaLabel={t('adminGuides.deleteLabel', { title: g.title })}
                  prompt={t('adminGuides.deletePrompt')}
                  confirmLabel={t('common.delete')}
                  onConfirm={async () => {
                    setRowError(null);
                    try {
                      await api<void>(`/api/admin/guides/${encodeURIComponent(g.slug)}`, { method: 'DELETE' });
                      if (editing?.slug === g.slug) setEditing(null);
                      reload();
                    } catch (err) {
                      setRowError(t('adminGuides.deleteError', { title: g.title, message: errorMessage(err) }));
                    }
                  }}
                >
                  <Trash2 size={14} aria-hidden /> {t('common.delete')}
                </ConfirmButton>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
