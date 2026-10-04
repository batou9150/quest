/** Game API (/game/*) types and calls. Described in /openapi.json, not in @quest/shared. */
import { api } from './api';

export interface Room {
  name: string;
  description: string;
  items?: string[];
  exits?: string[];
}

export interface LevelFinished {
  message: string;
  score: number;
}

export type MoveResult = Room | LevelFinished;

export function isLevelFinished(result: MoveResult): result is LevelFinished {
  return 'score' in result && typeof result.score === 'number';
}

export const game = {
  look: () => api<Room>('/game/look'),
  inventory: () => api<{ inventory: string[] }>('/game/inventory'),
  examine: (target: string) => api<{ description: string }>('/game/examine', { method: 'POST', body: { target } }),
  move: (exit: string) => api<MoveResult>('/game/move', { method: 'POST', body: { exit } }),
  take: (itemName: string) => api<{ message: string; item: string }>('/game/take', { method: 'POST', body: { itemName } }),
  drop: (itemName: string) => api<{ message: string }>('/game/drop', { method: 'POST', body: { itemName } }),
  use: (direct_object: string, indirect_object?: string) =>
    api<{ message: string }>('/game/use', {
      method: 'POST',
      body: indirect_object ? { direct_object, indirect_object } : { direct_object },
    }),
};

export const DIRECTION_SHORTCUTS: Record<string, string> = {
  n: 'north',
  s: 'south',
  e: 'east',
  w: 'west',
  u: 'up',
  d: 'down',
};

export type ParsedCommand =
  | { kind: 'look' }
  | { kind: 'inventory' }
  | { kind: 'examine'; target: string }
  | { kind: 'move'; exit: string }
  | { kind: 'take'; item: string }
  | { kind: 'drop'; item: string }
  | { kind: 'use'; direct: string; indirect?: string }
  | { kind: 'help' }
  | { kind: 'clear' }
  | { kind: 'usage'; message: string }
  | { kind: 'unknown'; verb: string };

/** Parses a terminal line. `exits` are the current room's exits, so bare exit names work as moves. */
export function parseCommand(line: string, exits: readonly string[]): ParsedCommand {
  const trimmed = line.trim().replace(/\s+/g, ' ');
  const lower = trimmed.toLowerCase();
  const [rawVerb = '', ...restWords] = trimmed.split(' ');
  const verb = rawVerb.toLowerCase();
  const arg = restWords.join(' ');

  const exitMatch = exits.find((e) => e.toLowerCase() === lower);
  if (exitMatch) return { kind: 'move', exit: exitMatch };

  switch (verb) {
    case 'look':
    case 'l':
      if (arg.toLowerCase().startsWith('at ')) return { kind: 'examine', target: arg.slice(3) };
      return arg ? { kind: 'examine', target: arg } : { kind: 'look' };
    case 'inventory':
    case 'inv':
    case 'i':
      return { kind: 'inventory' };
    case 'examine':
    case 'x':
      return arg ? { kind: 'examine', target: arg } : { kind: 'usage', message: 'Examine what? Usage: examine <thing>' };
    case 'move':
    case 'go':
    case 'walk': {
      if (!arg) return { kind: 'usage', message: 'Go where? Usage: move <exit>' };
      const expanded = DIRECTION_SHORTCUTS[arg.toLowerCase()] ?? arg;
      return { kind: 'move', exit: expanded };
    }
    case 'take':
    case 'get':
    case 'grab':
      return arg ? { kind: 'take', item: arg } : { kind: 'usage', message: 'Take what? Usage: take <item>' };
    case 'drop':
      return arg ? { kind: 'drop', item: arg } : { kind: 'usage', message: 'Drop what? Usage: drop <item>' };
    case 'use': {
      if (!arg) return { kind: 'usage', message: 'Use what? Usage: use <thing> [on|with <other>]' };
      const m = /^(.+?)\s+(?:on|with)\s+(.+)$/i.exec(arg);
      if (m?.[1] && m[2]) return { kind: 'use', direct: m[1], indirect: m[2] };
      return { kind: 'use', direct: arg };
    }
    case 'help':
    case '?':
      return { kind: 'help' };
    case 'clear':
    case 'cls':
      return { kind: 'clear' };
  }

  if (!arg) {
    const direction = DIRECTION_SHORTCUTS[verb];
    if (direction) return { kind: 'move', exit: direction };
  }
  return { kind: 'unknown', verb: rawVerb };
}
