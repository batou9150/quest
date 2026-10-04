import type { Condition, Level } from './schema.ts';

export type GraphNodeKind = 'room' | 'finish' | 'item' | 'flag' | 'action';

/**
 * Edge kinds, grouped for display:
 * - exit: room → room (or → finish), the level's map
 * - contains: room → item lying there at the start
 * - uses: item → action (`use X [on Y]`)
 * - sets / clears: action → flag
 * - gives / spawns / removes: action → item
 * - requires: flag or item → action, or → the room an exit unlocks
 * - forbids: flag → action that only applies while the flag is NOT set (hint rules)
 */
export type GraphEdgeKind =
  | 'exit'
  | 'contains'
  | 'uses'
  | 'sets'
  | 'clears'
  | 'gives'
  | 'spawns'
  | 'removes'
  | 'requires'
  | 'forbids';

export interface GraphNode {
  id: string;
  kind: GraphNodeKind;
  label: string;
  /** Extra line under the label (room scope of an action, "fixed" items, ...). */
  detail?: string;
  /** Longer text for a details panel. */
  description?: string;
  start?: boolean;
  /** Rooms only: false when no chain of exits leads there from the start room. */
  reachable?: boolean;
  /** Actions only: id of the room node the rule is limited to. */
  room?: string;
}

export interface GraphEdge {
  id: string;
  kind: GraphEdgeKind;
  source: string;
  target: string;
  label?: string;
  /** Exits only: true when the exit has requirements. */
  locked?: boolean;
  /** Exits only: true when it leads back toward the start (no farther from it than the room it leaves). */
  backward?: boolean;
}

export interface LevelGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

const FINISH = 'finish';
const roomId = (id: string) => `room:${id}`;
const itemId = (id: string) => `item:${id}`;
const flagId = (id: string) => `flag:${id}`;

/** Turns a level into a graph of rooms, items, flags and actions, for previews. Pure. */
export function levelGraph(level: Level): LevelGraph {
  const { world } = level;
  const nodes = new Map<string, GraphNode>();
  const edges: GraphEdge[] = [];
  const edge = (kind: GraphEdgeKind, source: string, target: string, label?: string, extra: Partial<GraphEdge> = {}) => {
    edges.push({ id: `e${edges.length}`, kind, source, target, label, ...extra });
  };
  const flag = (id: string) => {
    if (!nodes.has(flagId(id))) nodes.set(flagId(id), { id: flagId(id), kind: 'flag', label: id });
    return flagId(id);
  };
  const requirements = (cond: Condition | undefined, target: string, label?: string) => {
    for (const f of cond?.flags ?? []) edge('requires', flag(f), target, label);
    for (const i of cond?.inventory ?? []) edge('requires', itemId(i), target, label ? `carry, ${label}` : 'carry');
    for (const f of cond?.notFlags ?? []) edge('forbids', flag(f), target, 'unless');
  };

  for (const [id, item] of Object.entries(world.items)) {
    nodes.set(itemId(id), {
      id: itemId(id),
      kind: 'item',
      label: item.name,
      detail: item.takeable ? undefined : 'fixed',
      description: item.description,
    });
  }

  const depth = roomDepths(level);
  for (const [id, room] of Object.entries(world.rooms)) {
    nodes.set(roomId(id), {
      id: roomId(id),
      kind: 'room',
      label: room.name,
      description: room.description,
      start: id === world.start,
      reachable: depth.has(id),
    });
    for (const item of room.items) edge('contains', roomId(id), itemId(item));
    for (const [direction, exit] of Object.entries(room.exits)) {
      const target = exit.finish ? FINISH : roomId(exit.to!);
      if (exit.finish && !nodes.has(FINISH)) {
        nodes.set(FINISH, { id: FINISH, kind: 'finish', label: 'Level complete', description: exit.description });
      }
      const backward = !exit.finish && (depth.get(exit.to!) ?? Infinity) <= (depth.get(id) ?? Infinity);
      edge('exit', roomId(id), target, direction, { locked: !!exit.requires, backward });
      requirements(exit.requires, target, `opens ${direction}`);
    }
  }

  world.rules.forEach((rule, i) => {
    const id = `action:${i}`;
    const name = (ref: string) => world.items[ref]?.name ?? ref;
    nodes.set(id, {
      id,
      kind: 'action',
      label: rule.on ? `use ${name(rule.use)} on ${name(rule.on)}` : `use ${name(rule.use)}`,
      detail: rule.room ? `in ${world.rooms[rule.room]?.name ?? rule.room}` : undefined,
      description: rule.message,
      ...(rule.room ? { room: roomId(rule.room) } : {}),
    });
    if (world.items[rule.use]) edge('uses', itemId(rule.use), id, 'use');
    if (rule.on && world.items[rule.on]) edge('uses', itemId(rule.on), id, 'on');
    requirements(rule.requires, id);
    for (const effect of rule.effects) {
      if ('setFlag' in effect) edge('sets', id, flag(effect.setFlag));
      else if ('clearFlag' in effect) edge('clears', id, flag(effect.clearFlag));
      else if ('giveItem' in effect) edge('gives', id, itemId(effect.giveItem));
      else if ('spawnItem' in effect) edge('spawns', id, itemId(effect.spawnItem));
      else edge('removes', id, itemId(effect.removeItem));
    }
  });

  return { nodes: [...nodes.values()], edges };
}

/** Number of exits from the start to each reachable room, ignoring locks. */
function roomDepths(level: Level): Map<string, number> {
  const depth = new Map([[level.world.start, 0]]);
  const queue = [level.world.start];
  while (queue.length) {
    const id = queue.shift()!;
    for (const exit of Object.values(level.world.rooms[id]?.exits ?? {})) {
      if (exit.to && !depth.has(exit.to)) {
        depth.set(exit.to, depth.get(id)! + 1);
        queue.push(exit.to);
      }
    }
  }
  return depth;
}
