import { useState } from 'react';
import { Link } from 'react-router';
import { AlertTriangle, ExternalLink, FileCode2, Info, KeyRound, RefreshCw } from 'lucide-react';
import type { NewApiKey } from '@quest/shared';
import { api, errorMessage } from '../lib/api';
import { useMe } from '../lib/auth';
import { PageHeader } from '../components/PageHeader';
import { CopyButton } from '../components/CopyButton';
import { ConfirmButton } from '../components/ConfirmButton';
import { InlineError } from '../components/Status';
import { btnPrimary, btnSecondary, card } from '../components/ui';

const ENDPOINTS: { method: 'GET' | 'POST'; path: string; body?: string; desc: string }[] = [
  { method: 'GET', path: '/game/look', desc: 'Describe the current room: name, description, items, exits.' },
  { method: 'GET', path: '/game/inventory', desc: 'List the items you carry.' },
  { method: 'POST', path: '/game/examine', body: '{ "target" }', desc: 'Examine an item, feature or exit.' },
  { method: 'POST', path: '/game/move', body: '{ "exit" }', desc: 'Go through an exit. Returns the new room, or { message, score } when the level is completed.' },
  { method: 'POST', path: '/game/take', body: '{ "itemName" }', desc: 'Take an item from the room.' },
  { method: 'POST', path: '/game/drop', body: '{ "itemName" }', desc: 'Drop an item from your inventory.' },
  { method: 'POST', path: '/game/use', body: '{ "direct_object", "indirect_object"? }', desc: 'Use a thing, or two things on each other.' },
];

function KeyPanel() {
  const { me, refresh } = useMe();
  const [newKey, setNewKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await api<NewApiKey>('/api/me/api-key', { method: 'POST' });
      setNewKey(res.apiKey);
      await refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (!me) return null;

  return (
    <section className={`${card} space-y-4 p-6`} aria-labelledby="key-title">
      <h2 id="key-title" className="flex items-center gap-2 text-lg font-bold text-white">
        <KeyRound size={20} className="text-quantum-400" aria-hidden /> Your API key
      </h2>

      {newKey ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2 rounded-lg border border-quantum-800 bg-black/50 p-3">
            <code className="break-all font-mono text-sm text-quantum-300">{newKey}</code>
            <CopyButton text={newKey} label="Copy API key" />
          </div>
          <p role="alert" className="flex items-start gap-2 rounded-lg border border-amber-800/60 bg-amber-950/30 p-3 text-sm text-amber-200">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden />
            Copy this key now: it will not be shown again. Treat it like a password; anyone with it can play as you.
          </p>
        </div>
      ) : me.apiKeyPrefix ? (
        <div className="rounded-lg border border-slate-800 bg-black/50 p-3">
          <code className="font-mono text-sm text-slate-300">{me.apiKeyPrefix}…</code>
          <p className="mt-1 text-xs text-slate-500">For security, only the beginning of your key is shown. Regenerate it if you lost it.</p>
        </div>
      ) : (
        <p className="text-sm text-slate-400">You don't have an API key yet.</p>
      )}

      {error && <InlineError>{error}</InlineError>}

      {me.apiKeyPrefix || newKey ? (
        <ConfirmButton
          className={btnSecondary}
          prompt="This revokes your current key immediately. Continue?"
          confirmLabel="Regenerate"
          onConfirm={generate}
          disabled={busy}
        >
          <RefreshCw size={16} aria-hidden /> Regenerate key
        </ConfirmButton>
      ) : (
        <button type="button" className={btnPrimary} onClick={generate} disabled={busy}>
          <KeyRound size={16} aria-hidden /> {busy ? 'Generating…' : 'Generate API key'}
        </button>
      )}
    </section>
  );
}

export function GameApi() {
  const origin = window.location.origin;
  const curl = `curl ${origin}/game/look \\\n  -H "Authorization: ApiKey <YOUR_API_KEY>"`;
  const curlMove = `curl -X POST ${origin}/game/move \\\n  -H "Authorization: ApiKey <YOUR_API_KEY>" \\\n  -H "Content-Type: application/json" \\\n  -d '{"exit": "north"}'`;

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <PageHeader title="API Access" subtitle="Play the game from curl, a script or an AI agent." icon={<FileCode2 className="text-quantum-400" aria-hidden />} />

      <KeyPanel />

      <section className={`${card} space-y-4 p-6`} aria-labelledby="quickstart-title">
        <h2 id="quickstart-title" className="text-lg font-bold text-white">
          Quick start
        </h2>
        <p className="flex items-start gap-2 rounded-lg border border-quantum-900 bg-quantum-950/40 p-3 text-sm text-slate-300">
          <Info size={16} className="mt-0.5 shrink-0 text-quantum-400" aria-hidden />
          <span>
            Start a level from{' '}
            <Link to="/level-select" className="font-bold text-quantum-400 hover:underline">
              Level Select
            </Link>{' '}
            first. The API always acts on your <strong className="text-white">active level</strong> (the one you last started or resumed),
            the same one as the web terminal. Without one, game calls answer <code className="font-mono">409 no_active_level</code>.
          </span>
        </p>
        {[curl, curlMove].map((snippet) => (
          <div key={snippet} className="relative">
            <pre className="overflow-x-auto rounded-lg border border-slate-800 bg-slate-950 p-4 pr-14 font-mono text-sm text-emerald-300">{snippet}</pre>
            <div className="absolute right-2 top-2">
              <CopyButton text={snippet} label="Copy command" />
            </div>
          </div>
        ))}
        <p className="text-sm text-slate-400">
          Errors are JSON: <code className="font-mono text-slate-300">{'{ "error", "message" }'}</code> with status 400 (unknown target, locked
          exit…), 401 (bad key), 409 (no active level) or 429 (rate limited).
        </p>
      </section>

      <div className="grid gap-6 md:grid-cols-5">
        <section className={`${card} p-6 md:col-span-3`} aria-labelledby="endpoints-title">
          <h2 id="endpoints-title" className="mb-4 font-bold text-white">
            Game endpoints
          </h2>
          <ul className="space-y-3 text-sm">
            {ENDPOINTS.map((e) => (
              <li key={e.path}>
                <div className="flex flex-wrap items-baseline gap-x-3 font-mono">
                  <span className={`w-12 font-bold ${e.method === 'GET' ? 'text-emerald-400' : 'text-sky-400'}`}>{e.method}</span>
                  <span className="text-slate-200">{e.path}</span>
                  {e.body && <span className="text-xs text-slate-500">{e.body}</span>}
                </div>
                <p className="ml-0 text-slate-400 sm:ml-[3.75rem]">{e.desc}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="flex flex-col items-center justify-center rounded-xl border border-slate-700 bg-gradient-to-br from-slate-900 to-slate-800 p-6 text-center md:col-span-2">
          <div className="mb-4 rounded-full bg-white/5 p-4">
            <ExternalLink size={24} className="text-white" aria-hidden />
          </div>
          <h2 className="mb-2 font-bold text-white">Full specification</h2>
          <p className="mb-6 text-sm text-slate-400">Every request and response schema, in OpenAPI format. Feed it to your agent.</p>
          <a href="/openapi.json" target="_blank" rel="noopener" className={btnPrimary}>
            View openapi.json
          </a>
        </section>
      </div>
    </div>
  );
}
