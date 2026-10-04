import type { ReactNode } from 'react';
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
  const items = room.items ?? [];
  const exits = room.exits ?? [];
  return (
    <div className="space-y-2">
      <h3 className="text-base font-bold uppercase tracking-widest text-quantum-400">{room.name}</h3>
      <p className="whitespace-pre-line leading-relaxed text-slate-300">{room.description}</p>
      {items.length > 0 && (
        <p className="text-amber-200">
          <span className="mr-2 text-xs font-bold uppercase text-slate-500">Items:</span>
          {items.join(', ')}
        </p>
      )}
      <p className="text-sky-300">
        <span className="mr-2 text-xs font-bold uppercase text-slate-500">Exits:</span>
        {exits.length > 0 ? exits.join(', ') : 'none'}
      </p>
    </div>
  );
}

const HELP: [string, string][] = [
  ['look, l', 'Describe the current room'],
  ['inventory, i', 'List what you carry'],
  ['examine, x <thing>', 'Look closely at an item, feature or exit'],
  ['move, go <exit>', 'Go through an exit (also: n s e w u d, or just the exit name)'],
  ['take, get <item>', 'Pick up an item'],
  ['drop <item>', 'Drop an item you carry'],
  ['use <a> [on|with <b>]', 'Use something, or use two things together'],
  ['clear', 'Clear the terminal'],
  ['↑ / ↓', 'Browse command history'],
];

export function HelpView() {
  return (
    <div className="text-slate-400">
      <p className="mb-1">Available commands:</p>
      <dl className="grid gap-x-4 gap-y-0.5 sm:grid-cols-[auto_1fr]">
        {HELP.map(([cmd, desc]) => (
          <div key={cmd} className="contents">
            <dt className="text-white">{cmd}</dt>
            <dd className="mb-1 sm:mb-0">{desc}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export function LogLine({ entry }: { entry: LogEntry }) {
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
          <span className="font-bold">[ERROR]</span> {entry.text} {entry.link}
        </p>
      );
    case 'info':
      return <p className="text-slate-500">{entry.text}</p>;
    case 'help':
      return <HelpView />;
  }
}
