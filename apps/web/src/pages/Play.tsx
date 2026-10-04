import { useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { Link } from 'react-router';
import { Send, Terminal as TerminalIcon, Trophy } from 'lucide-react';
import { Trans, useTranslation } from 'react-i18next';
import type { LevelSummary } from '@quest/shared';
import { ApiError, errorMessage } from '../lib/api';
import { game, isLevelFinished, parseCommand, type LevelFinished, type Room } from '../lib/game';
import { useApi } from '../lib/hooks';
import { useMe } from '../lib/auth';
import { formatNumber } from '../lib/format';
import i18n from '../i18n';
import { LogLine, type LogEntry } from '../components/Terminal';
import { btnPrimary } from '../components/ui';

type NewEntry = LogEntry extends infer E ? (E extends LogEntry ? Omit<E, 'id'> : never) : never;

function FinishedBanner({ result }: { result: LevelFinished }) {
  const { t } = useTranslation();
  return (
    <div role="status" className="flex flex-col gap-4 rounded-xl border border-emerald-700/60 bg-emerald-950/40 p-5 sm:flex-row sm:items-center">
      <Trophy size={32} className="shrink-0 text-amber-300" aria-hidden />
      <div className="flex-1">
        <p className="font-bold text-emerald-300">{t('play.complete')}</p>
        <p className="text-sm text-slate-300">{result.message}</p>
      </div>
      <div className="text-left sm:text-right">
        <p className="text-xs uppercase tracking-widest text-slate-500">{t('play.score')}</p>
        <p className="font-mono text-3xl font-bold text-quantum-300">{formatNumber(result.score)}</p>
      </div>
      <Link to="/level-select" className={btnPrimary}>
        {t('nav.levelSelect')}
      </Link>
    </div>
  );
}

function LevelSelectLink() {
  const { t } = useTranslation();
  return (
    <Link to="/level-select" className="text-quantum-400 underline">
      {t('play.goToLevelSelect')}
    </Link>
  );
}

function LoginLink() {
  const { t } = useTranslation();
  return (
    <Link to="/login" className="text-quantum-400 underline">
      {t('play.logInAgain')}
    </Link>
  );
}

export function Play() {
  const { t } = useTranslation();
  const { refresh } = useMe();
  const { data: levels } = useApi<LevelSummary[]>('/api/levels');
  const activeLevel = levels?.find((l) => l.active);

  const [log, setLog] = useState<LogEntry[]>(() => [{ id: -1, kind: 'info', text: t('play.connecting') }]);
  const [room, setRoom] = useState<Room | null>(null);
  const [finished, setFinished] = useState<LevelFinished | null>(null);
  const [noActiveLevel, setNoActiveLevel] = useState(false);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number | null>(null);

  const nextId = useRef(0);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const push = useCallback((...entries: NewEntry[]) => {
    setLog((prev) => [...prev, ...entries.map((e) => ({ ...e, id: nextId.current++ }) as LogEntry)]);
  }, []);

  // Log lines are printed once, in the language of the moment; i18n.t (stable) keeps these callbacks from re-running on a language switch.
  const pushError = useCallback(
    (err: unknown) => {
      if (err instanceof ApiError) {
        if (err.status === 409) {
          setNoActiveLevel(true);
          push({ kind: 'error', text: err.message || i18n.t('play.noActiveLevelError'), link: <LevelSelectLink /> });
          return;
        }
        if (err.status === 401) {
          push({ kind: 'error', text: i18n.t('play.sessionExpired'), link: <LoginLink /> });
          return;
        }
        if (err.status === 429) {
          push({ kind: 'error', text: i18n.t('play.slowDown', { message: err.message }) });
          return;
        }
      }
      push({ kind: 'error', text: errorMessage(err) });
    },
    [push],
  );

  useEffect(() => {
    let cancelled = false;
    game
      .look()
      .then((r) => {
        if (cancelled) return;
        setRoom(r);
        push({ kind: 'info', text: i18n.t('play.established') }, { kind: 'room', room: r });
      })
      .catch((err: unknown) => {
        if (!cancelled) pushError(err);
      });
    return () => {
      cancelled = true;
    };
  }, [push, pushError]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [log]);

  const execute = async (line: string) => {
    const cmd = parseCommand(line, room?.exits ?? []);
    switch (cmd.kind) {
      case 'help':
        push({ kind: 'help' });
        return;
      case 'clear':
        setLog([]);
        return;
      case 'usage':
        push({ kind: 'info', text: t(`play.usage.${cmd.verb}`) });
        return;
      case 'unknown':
        push({ kind: 'info', text: t('play.unknownCommand', { verb: cmd.verb }) });
        return;
      case 'look': {
        const r = await game.look();
        setRoom(r);
        push({ kind: 'room', room: r });
        return;
      }
      case 'inventory': {
        const { inventory } = await game.inventory();
        push({ kind: 'list', title: t('play.inventory'), items: inventory, empty: t('play.carryingNothing') });
        return;
      }
      case 'examine': {
        const { description } = await game.examine(cmd.target);
        push({ kind: 'text', text: description });
        return;
      }
      case 'move': {
        const result = await game.move(cmd.exit);
        if (isLevelFinished(result)) {
          setFinished(result);
          push({ kind: 'text', text: result.message }, { kind: 'info', text: t('play.completeLog', { score: formatNumber(result.score) }) });
          void refresh();
        } else {
          setRoom(result);
          push({ kind: 'room', room: result });
        }
        return;
      }
      case 'take': {
        const { message } = await game.take(cmd.item);
        push({ kind: 'text', text: message });
        return;
      }
      case 'drop': {
        const { message } = await game.drop(cmd.item);
        push({ kind: 'text', text: message });
        return;
      }
      case 'use': {
        const { message } = await game.use(cmd.direct, cmd.indirect);
        push({ kind: 'text', text: message });
        return;
      }
    }
  };

  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    const line = input.trim();
    if (!line || busy) return;
    setInput('');
    setHistoryIndex(null);
    setHistory((h) => (h[h.length - 1] === line ? h : [...h, line]));
    push({ kind: 'command', text: line });
    setBusy(true);
    try {
      await execute(line);
    } catch (err) {
      pushError(err);
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowUp') {
      if (history.length === 0) return;
      e.preventDefault();
      const idx = historyIndex === null ? history.length - 1 : Math.max(0, historyIndex - 1);
      setHistoryIndex(idx);
      setInput(history[idx] ?? '');
    } else if (e.key === 'ArrowDown') {
      if (historyIndex === null) return;
      e.preventDefault();
      const idx = historyIndex + 1;
      if (idx >= history.length) {
        setHistoryIndex(null);
        setInput('');
      } else {
        setHistoryIndex(idx);
        setInput(history[idx] ?? '');
      }
    }
  };

  return (
    <div className="space-y-4">
      {finished && <FinishedBanner result={finished} />}
      {noActiveLevel && !finished && (
        <div role="alert" className="rounded-xl border border-amber-800/60 bg-amber-950/30 p-4 text-amber-200">
          <Trans i18nKey="play.noActiveLevel" components={{ a: <Link to="/level-select" className="font-bold text-quantum-400 underline" /> }} />
        </div>
      )}

      <section aria-label={t('play.terminal')} className="flex h-[calc(100dvh-12rem)] min-h-[24rem] flex-col overflow-hidden rounded-xl border border-slate-800 bg-slate-950 shadow-2xl md:h-[calc(100dvh-10rem)]">
        <div className="flex items-center gap-2 border-b border-slate-800 bg-slate-900 px-3 py-2.5">
          <TerminalIcon size={16} className="shrink-0 text-quantum-400" aria-hidden />
          <span className="truncate font-mono text-xs text-slate-400">
            REMOTE_UPLINK //{' '}
            {activeLevel
              ? t('play.levelTag', { number: String(activeLevel.number).padStart(2, '0'), title: activeLevel.title.toUpperCase() })
              : t('play.noLevel')}{' '}
            // {room?.name.toUpperCase() ?? t('play.initializing')}
          </span>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto p-4 font-mono text-sm md:p-6" role="log" aria-live="polite" onClick={() => inputRef.current?.focus()}>
          {log.map((entry) => (
            <LogLine key={entry.id} entry={entry} />
          ))}
          {busy && <p className="animate-pulse text-slate-600">…</p>}
          <div ref={bottomRef} />
        </div>

        <form onSubmit={submit} className="flex gap-2 border-t border-slate-800 bg-slate-900/50 p-3">
          <div className="relative flex-1">
            <span aria-hidden className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-quantum-500">
              $
            </span>
            <label htmlFor="cmd-input" className="sr-only">
              {t('play.command')}
            </label>
            <input
              id="cmd-input"
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 py-2.5 pl-8 pr-3 font-mono text-emerald-400 placeholder-slate-700 focus:border-quantum-500 focus:outline-none focus:ring-1 focus:ring-quantum-500/50"
              placeholder={t('play.placeholder')}
              autoFocus
              autoComplete="off"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
            />
          </div>
          <button type="submit" aria-label={t('play.send')} disabled={busy || !input.trim()} className="rounded-lg bg-quantum-600 px-4 text-white transition-colors hover:bg-quantum-500 disabled:opacity-50">
            <Send size={18} aria-hidden />
          </button>
        </form>
      </section>
    </div>
  );
}
