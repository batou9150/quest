import { localize, messagesFor, type Messages } from './i18n.ts';
import type { Condition, Effect, Level, World } from './schema.ts';

export interface GameState {
  roomId: string;
  inventory: string[];
  /** Items lying in each room, by room id. */
  roomItems: Record<string, string[]>;
  flags: string[];
  /** Counted actions: examine, move, take, drop and use (look and inventory are free). */
  actions: number;
  finished: boolean;
  score: number | null;
}

export type Command =
  | { type: 'look' }
  | { type: 'inventory' }
  | { type: 'examine'; target: string }
  | { type: 'move'; exit: string }
  | { type: 'take'; itemName: string }
  | { type: 'drop'; itemName: string }
  | { type: 'use'; direct_object: string; indirect_object?: string | null };

export interface RoomView {
  name: string;
  description: string;
  items: string[];
  exits: string[];
}

export type GameErrorCode = 'unknown_target' | 'unknown_exit' | 'locked' | 'not_takeable' | 'not_carrying' | 'level_finished';

export type StepResult =
  | { ok: true; body: unknown }
  | { ok: false; error: GameErrorCode; message: string };

const COUNTED: ReadonlySet<Command['type']> = new Set(['examine', 'move', 'take', 'drop', 'use']);
const DIRECTION_SHORTCUTS: Record<string, string> = { n: 'north', s: 'south', e: 'east', w: 'west', u: 'up', d: 'down' };

export function newGame(level: Level): GameState {
  const { world } = level;
  return {
    roomId: world.start,
    inventory: [],
    roomItems: Object.fromEntries(Object.entries(world.rooms).map(([id, room]) => [id, [...room.items]])),
    flags: [],
    actions: 0,
    finished: false,
    score: null,
  };
}

export function scoreFor(level: Level, actions: number): number {
  const floor = Math.ceil(level.points * 0.2);
  return Math.max(floor, level.points - Math.max(0, actions - level.par) * level.penaltyPerAction);
}

/**
 * Applies one command, answering in `lang` (see `localize`). Never mutates `state`;
 * returns the next state and the response body or error.
 */
export function step(
  level: Level,
  state: GameState,
  command: Command,
  lang = 'en',
): { state: GameState; result: StepResult } {
  const msg = messagesFor(lang);
  if (state.finished) return { state, result: fail('level_finished', msg.levelFinished) };
  const next = structuredClone(state);
  if (COUNTED.has(command.type)) next.actions += 1;
  const result = run(localize(level, lang), msg, next, command);
  return { state: next, result };
}

export function viewRoom(world: World, state: GameState): RoomView {
  const room = world.rooms[state.roomId]!;
  const extra = room.descriptionWhen.filter((d) => state.flags.includes(d.flag)).map((d) => d.text);
  return {
    name: room.name,
    description: [room.description, ...extra].join(' '),
    items: (state.roomItems[state.roomId] ?? []).map((id) => world.items[id]!.name),
    exits: Object.keys(room.exits),
  };
}

function run(level: Level, msg: Messages, state: GameState, command: Command): StepResult {
  const { world } = level;
  switch (command.type) {
    case 'look':
      return ok(viewRoom(world, state));

    case 'inventory':
      return ok({ inventory: state.inventory.map((id) => world.items[id]!.name) });

    case 'examine': {
      const query = normalize(command.target);
      const room = world.rooms[state.roomId]!;
      const itemId = findItem(world, query, [...state.inventory, ...roomItems(state)]);
      if (itemId) return ok({ description: world.items[itemId]!.description });
      const exitKey = findExit(room.exits, query);
      if (exitKey) return ok({ description: room.exits[exitKey]!.description ?? msg.nothingSpecial });
      if ([...messagesFor('en').roomWords, ...msg.roomWords, normalize(room.name)].includes(query)) {
        return ok({ description: viewRoom(world, state).description });
      }
      return fail('unknown_target', msg.notHere(command.target));
    }

    case 'move': {
      const room = world.rooms[state.roomId]!;
      const exitKey = findExit(room.exits, normalize(command.exit));
      if (!exitKey) return fail('unknown_exit', msg.noExit(command.exit, Object.keys(room.exits)));
      const exit = room.exits[exitKey]!;
      if (exit.requires && !holds(exit.requires, state)) return fail('locked', exit.lockedMessage ?? msg.wayBlocked);
      if (exit.finish) {
        state.finished = true;
        state.score = scoreFor(level, state.actions);
        return ok({
          message: msg.complete(level.title, state.actions),
          score: state.score,
        });
      }
      state.roomId = exit.to!;
      return ok(viewRoom(world, state));
    }

    case 'take': {
      const here = roomItems(state);
      const itemId = findItem(world, normalize(command.itemName), here);
      if (!itemId) {
        if (findItem(world, normalize(command.itemName), state.inventory)) {
          return fail('unknown_target', msg.alreadyCarried);
        }
        return fail('unknown_target', msg.notHere(command.itemName));
      }
      const item = world.items[itemId]!;
      if (!item.takeable) return fail('not_takeable', item.fixedMessage ?? msg.wontBudge);
      state.roomItems[state.roomId] = here.filter((id) => id !== itemId);
      state.inventory.push(itemId);
      return ok({ message: msg.taken(item.name), item: item.name });
    }

    case 'drop': {
      const itemId = findItem(world, normalize(command.itemName), state.inventory);
      if (!itemId) return fail('not_carrying', msg.notCarried(command.itemName));
      state.inventory = state.inventory.filter((id) => id !== itemId);
      state.roomItems[state.roomId] = [...roomItems(state), itemId];
      return ok({ message: msg.dropped(world.items[itemId]!.name) });
    }

    case 'use': {
      const direct = resolveThing(world, state, command.direct_object);
      if (!direct) return fail('unknown_target', msg.notHere(command.direct_object));
      const indirectQuery = command.indirect_object?.trim() || undefined;
      const indirect = indirectQuery ? resolveThing(world, state, indirectQuery) : undefined;
      if (indirectQuery && !indirect) return fail('unknown_target', msg.notHere(indirectQuery));

      const applicable = world.rules.filter((r) => !r.room || r.room === state.roomId);
      const rule = applicable.find(
        (r) => ((r.use === direct && r.on === indirect) || (indirect && r.use === indirect && r.on === direct)) &&
          (!r.requires || holds(r.requires, state)),
      );
      if (rule) {
        for (const effect of rule.effects) apply(effect, state);
        return ok({ message: rule.message });
      }
      if (!indirect && applicable.some((r) => r.use === direct && r.on)) {
        return ok({ message: msg.useOnWhat });
      }
      return ok({ message: msg.nothingHappens });
    }
  }
}

function apply(effect: Effect, state: GameState): void {
  if ('setFlag' in effect) {
    if (!state.flags.includes(effect.setFlag)) state.flags.push(effect.setFlag);
  } else if ('clearFlag' in effect) {
    state.flags = state.flags.filter((f) => f !== effect.clearFlag);
  } else if ('removeItem' in effect) {
    removeEverywhere(state, effect.removeItem);
  } else if ('giveItem' in effect) {
    removeEverywhere(state, effect.giveItem);
    state.inventory.push(effect.giveItem);
  } else {
    removeEverywhere(state, effect.spawnItem);
    state.roomItems[state.roomId] = [...roomItems(state), effect.spawnItem];
  }
}

function removeEverywhere(state: GameState, itemId: string): void {
  state.inventory = state.inventory.filter((id) => id !== itemId);
  for (const room of Object.keys(state.roomItems)) {
    state.roomItems[room] = state.roomItems[room]!.filter((id) => id !== itemId);
  }
}

function holds(cond: Condition, state: GameState): boolean {
  return (
    cond.flags.every((f) => state.flags.includes(f)) &&
    cond.notFlags.every((f) => !state.flags.includes(f)) &&
    cond.inventory.every((i) => state.inventory.includes(i))
  );
}

/** Resolves user text to an item id (inventory or room) or an exit key of the current room. */
function resolveThing(world: World, state: GameState, text: string): string | undefined {
  const query = normalize(text);
  return findItem(world, query, [...state.inventory, ...roomItems(state)]) ?? findExit(world.rooms[state.roomId]!.exits, query);
}

function findItem(world: World, query: string, candidates: string[]): string | undefined {
  return candidates.find((id) => {
    const item = world.items[id]!;
    return id === query || normalize(item.name) === query || item.aliases.some((a) => normalize(a) === query);
  });
}

function findExit(exits: Record<string, unknown>, query: string): string | undefined {
  const wanted = DIRECTION_SHORTCUTS[query] ?? query;
  return Object.keys(exits).find((key) => normalize(key) === wanted);
}

function roomItems(state: GameState): string[] {
  return state.roomItems[state.roomId] ?? [];
}

function normalize(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/’/g, "'")
    .replace(/^(?:(?:the|a|an|le|la|les|un|une|des|du|de la) |l')/, '');
}

function ok(body: unknown): StepResult {
  return { ok: true, body };
}

function fail(error: GameErrorCode, message: string): StepResult {
  return { ok: false, error, message };
}
