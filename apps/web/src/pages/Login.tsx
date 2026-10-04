import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { FlaskConical } from 'lucide-react';
import type { AuthProviders } from '@quest/shared';
import { api, errorMessage } from '../lib/api';
import { useApi } from '../lib/hooks';
import { useMe } from '../lib/auth';
import { LogoMark } from '../components/Logo';
import { GitHubIcon, GoogleIcon } from '../components/BrandIcons';
import { ErrorMessage, InlineError, Loading } from '../components/Status';
import { btnSecondary, input, label } from '../components/ui';

function DevLogin() {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { refresh } = useMe();
  const navigate = useNavigate();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api<void>('/auth/dev', { method: 'POST', body: { name: name.trim() } });
      if (await refresh()) navigate('/level-select', { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3 rounded-lg border border-dashed border-amber-800/70 bg-amber-950/20 p-4 text-left">
      <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-300">
        <FlaskConical size={14} aria-hidden /> Dev login (local only)
      </p>
      <div>
        <label htmlFor="dev-name" className={label}>
          Name
        </label>
        <input id="dev-name" className={input} value={name} onChange={(e) => setName(e.target.value)} placeholder="Alice" required minLength={1} autoComplete="off" />
      </div>
      {error && <InlineError>{error}</InlineError>}
      <button type="submit" className={`${btnSecondary} w-full`} disabled={busy || !name.trim()}>
        {busy ? 'Connecting…' : 'Log in as this user'}
      </button>
    </form>
  );
}

export function Login() {
  const { data: providers, error, loading, reload } = useApi<AuthProviders>('/auth/providers');
  const none = providers && !providers.google && !providers.github && !providers.dev;

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 text-center shadow-2xl sm:p-8">
        <div className="mb-6 flex justify-center">
          <LogoMark size="lg" />
        </div>
        <h1 className="mb-2 text-2xl font-bold text-white">Identify yourself</h1>
        <p className="mb-8 text-slate-400">Connect to save your progress, get an API key and join events.</p>

        {loading && !providers ? (
          <Loading label="Loading sign-in options…" />
        ) : error ? (
          <ErrorMessage error={error} onRetry={reload} title="Could not load sign-in options" />
        ) : (
          <div className="space-y-4">
            {providers?.github && (
              <a href="/auth/github" className="flex w-full items-center justify-center gap-3 rounded-lg border border-slate-700 bg-slate-800 p-3 font-bold text-white transition-colors hover:bg-slate-700">
                <GitHubIcon /> Continue with GitHub
              </a>
            )}
            {providers?.google && (
              <a href="/auth/google" className="flex w-full items-center justify-center gap-3 rounded-lg bg-white p-3 font-bold text-slate-900 transition-colors hover:bg-slate-200">
                <GoogleIcon /> Continue with Google
              </a>
            )}
            {providers?.dev && <DevLogin />}
            {none && <p className="text-sm text-slate-500">No sign-in method is configured on this server.</p>}
          </div>
        )}

        <p className="mt-8 text-xs text-slate-600">An account is created automatically the first time you connect.</p>
      </div>
    </div>
  );
}
