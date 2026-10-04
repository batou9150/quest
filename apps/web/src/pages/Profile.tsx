import { useEffect, useState, type FormEvent } from 'react';
import { Check, Save, Sparkles, User as UserIcon } from 'lucide-react';
import { UpdateProfileSchema, type Me, type NameSuggestions } from '@quest/shared';
import { api, errorMessage } from '../lib/api';
import { useMe } from '../lib/auth';
import { formatDate, formatNumber } from '../lib/format';
import { PageHeader } from '../components/PageHeader';
import { InlineError } from '../components/Status';
import { btnPrimary, btnSecondary, chip, chipIdle, input, label } from '../components/ui';

function NameSuggester({ onPick }: { onPick: (name: string) => void }) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await api<NameSuggestions>('/api/me/name-suggestions');
      setSuggestions(res.suggestions);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <button type="button" className={btnSecondary} onClick={load} disabled={busy}>
        <Sparkles size={16} aria-hidden /> {busy ? 'Generating…' : suggestions.length ? 'More suggestions' : 'Suggest names'}
      </button>
      {error && <InlineError>{error}</InlineError>}
      {suggestions.length > 0 && (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Name suggestions">
          {suggestions.map((s) => (
            <button key={s} type="button" className={`${chip} ${chipIdle}`} onClick={() => onPick(s)}>
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ProfileForm({ me }: { me: Me }) {
  const { refresh } = useMe();
  const [displayName, setDisplayName] = useState(me.displayName);
  const [bio, setBio] = useState(me.bio);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!saved) return;
    const id = window.setTimeout(() => setSaved(false), 2500);
    return () => window.clearTimeout(id);
  }, [saved]);

  const dirty = displayName !== me.displayName || bio !== me.bio;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const parsed = UpdateProfileSchema.safeParse({ displayName, bio });
    if (!parsed.success) {
      setError(parsed.error.issues.map((i) => `${i.path.join('.') || 'value'}: ${i.message}`).join(' · '));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api<unknown>('/api/me', { method: 'PATCH', body: parsed.data });
      await refresh();
      setSaved(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="w-full flex-1 space-y-6">
      <div>
        <label htmlFor="displayName" className={label}>
          Display name
        </label>
        <div className="relative">
          <UserIcon className="pointer-events-none absolute left-3 top-2.5 text-slate-500" size={18} aria-hidden />
          <input
            id="displayName"
            className={`${input} pl-10`}
            value={displayName}
            onChange={(e) => {
              setDisplayName(e.target.value);
              setSaved(false);
            }}
            minLength={2}
            maxLength={40}
            required
            aria-describedby="displayName-help"
          />
        </div>
        <p id="displayName-help" className="mt-1 text-xs text-slate-500">
          2–40 characters. Shown on leaderboards.
        </p>
      </div>

      <NameSuggester
        onPick={(name) => {
          setDisplayName(name);
          setSaved(false);
        }}
      />

      <div>
        <label htmlFor="bio" className={label}>
          Bio
        </label>
        <textarea
          id="bio"
          className={`${input} h-32 resize-y`}
          value={bio}
          maxLength={500}
          onChange={(e) => {
            setBio(e.target.value);
            setSaved(false);
          }}
        />
        <p className="mt-1 text-right font-mono text-xs text-slate-600">{bio.length}/500</p>
      </div>

      {error && <InlineError>{error}</InlineError>}

      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" className={btnPrimary} disabled={busy || !dirty}>
          <Save size={16} aria-hidden /> {busy ? 'Saving…' : 'Save changes'}
        </button>
        <span aria-live="polite" className="flex items-center gap-1 text-sm text-emerald-400">
          {saved && (
            <>
              <Check size={16} aria-hidden /> Profile updated
            </>
          )}
        </span>
      </div>
    </form>
  );
}

export function Profile() {
  const { me } = useMe();
  if (!me) return null; // guarded by RequireAuth

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <PageHeader title="Profile" subtitle="How other players see you." />
      <div className="flex flex-col items-start gap-8 rounded-xl border border-slate-800 bg-slate-900 p-6 sm:p-8 md:flex-row">
        <div className="flex w-full shrink-0 flex-col items-center gap-3 text-center md:w-auto">
          {me.avatarUrl ? (
            <img src={me.avatarUrl} alt={`Avatar of ${me.displayName}`} className="h-28 w-28 rounded-full border-4 border-slate-800 shadow-xl" />
          ) : (
            <span aria-hidden className="flex h-28 w-28 items-center justify-center rounded-full border-4 border-slate-800 bg-slate-800 text-4xl font-bold text-slate-400">
              {me.displayName.slice(0, 1).toUpperCase()}
            </span>
          )}
          <div>
            <p className="text-xs uppercase tracking-widest text-slate-500">Total score</p>
            <p className="font-mono text-2xl font-bold text-quantum-400">{formatNumber(me.totalScore)} pts</p>
          </div>
          <dl className="space-y-1 text-xs text-slate-500">
            <div>
              <dt className="inline">Email: </dt>
              <dd className="inline break-all text-slate-400">{me.email}</dd>
            </div>
            <div>
              <dt className="inline">Member since: </dt>
              <dd className="inline text-slate-400">{formatDate(me.createdAt)}</dd>
            </div>
            {me.role === 'admin' && <div className="font-mono font-bold text-accent-300">ADMIN</div>}
          </dl>
        </div>
        <ProfileForm key={me.id} me={me} />
      </div>
    </div>
  );
}
