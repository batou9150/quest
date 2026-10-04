import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { Room } from '../lib/game';

export type LogEntry =
  | { id: number; kind: 'command'; text: string }
  | { id: number; kind: 'room'; room: Room }
  | { id: number; kind: 'text'; text: string }
  | { id: number; kind: 'list'; title: string; items: string[]; empty: string }
  | { id: number; kind: 'error'; text: string; link?: ReactNode }
  | { id: number; kind: 'info'; text: string }
  | { id: number; kind: 'help' };

export function RoomView({ room }: { room: Room }) {
  const { t } = useTranslation();
  const items = room.items ?? [];
  const exits = room.exits ?? [];
  return (
    <div className="space-y-2">
      <h3 className="text-base font-bold uppercase tracking-widest text-quantum-400">{room.name}</h3>
      <p className="whitespace-pre-line leading-relaxed text-slate-300">{room.description}</p>
      {items.length > 0 && (
        <p className="text-amber-200">
          <span className="mr-2 text-xs font-bold uppercase text-slate-500">{t('terminal.items')}</span>
          {items.join(', ')}
        </p>
      )}
      <p className="text-sky-300">
        <span className="mr-2 text-xs font-bold uppercase text-slate-500">{t('terminal.exits')}</span>
        {exits.length > 0 ? exits.join(', ') : t('terminal.none')}
      </p>
    </div>
  );
}

/** Command words stay English (the game parses them); only their descriptions are translated. */
const HELP = [
  ['look, l', 'look'],
  ['inventory, i', 'inventory'],
  ['examine, x <thing>', 'examine'],
  ['move, go <exit>', 'move'],
  ['take, get <item>', 'take'],
  ['drop <item>', 'drop'],
  ['use <a> [on|with <b>]', 'use'],
  ['clear', 'clear'],
  ['↑ / ↓', 'history'],
] as const;

export function HelpView() {
  const { t } = useTranslation();
  return (
    <div className="text-slate-400">
      <p className="mb-1">{t('terminal.helpTitle')}</p>
      <dl className="grid gap-x-4 gap-y-0.5 sm:grid-cols-[auto_1fr]">
        {HELP.map(([cmd, desc]) => (
          <div key={cmd} className="contents">
            <dt className="text-white">{cmd}</dt>
            <dd className="mb-1 sm:mb-0">{t(`terminal.help.${desc}`)}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export function LogLine({ entry }: { entry: LogEntry }) {
  const { t } = useTranslation();
  switch (entry.kind) {
    case 'command':
      return (
        <div className="mt-5 text-slate-500 first:mt-0">
          <span className="mr-2 text-quantum-500">$</span>
          {entry.text}
        </div>
      );
    case 'room':
      return <RoomView room={entry.room} />;
    case 'text':
      return <p className="whitespace-pre-line text-slate-200">{entry.text}</p>;
    case 'list':
      return (
        <p className="text-slate-200">
          {entry.items.length === 0 ? (
            entry.empty
          ) : (
            <>
              <span className="mr-2 text-xs font-bold uppercase text-slate-500">{entry.title}:</span>
              {entry.items.join(', ')}
            </>
          )}
        </p>
      );
    case 'error':
      return (
        <p className="text-red-400">
          <span className="font-bold">{t('terminal.error')}</span> {entry.text} {entry.link}
        </p>
      );
    case 'info':
      return <p className="text-slate-500">{entry.text}</p>;
    case 'help':
      return <HelpView />;
  }
}
