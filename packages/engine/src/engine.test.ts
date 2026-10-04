import { describe, expect, it } from 'vitest';
import { newGame, parseLevel, step } from './index.ts';

const base = {
  id: 'tiny',
  number: 1,
  title: 'Tiny',
  points: 50,
  par: 3,
  world: {
    start: 'a',
    rooms: {
      a: { name: 'Room A', description: 'A.', items: ['key', 'statue'], exits: { east: { to: 'b' } } },
      b: { name: 'Room B', description: 'B.', exits: { west: { to: 'a' }, out: { finish: true } } },
    },
    items: {
      key: { name: 'Brass Key', description: 'A key.' },
      statue: { name: 'Statue', description: 'Heavy.', takeable: false },
    },
  },
};

describe('parseLevel', () => {
  it('accepts a valid level and fills defaults', () => {
    const level = parseLevel(base);
    expect(level.penaltyPerAction).toBe(5);
    expect(level.world.rules).toEqual([]);
  });

  it('reports broken references', () => {
    const broken = structuredClone(base) as any;
    broken.world.start = 'nowhere';
    broken.world.rooms.a.items.push('ghost');
    broken.world.rooms.b.exits = { west: { to: 'a' } };
    expect(() => parseLevel(broken)).toThrow(/start room "nowhere"[\s\S]*unknown item "ghost"[\s\S]*cannot be completed/);
  });
});

describe('step', () => {
  const level = parseLevel(base);

  it('does not mutate the previous state', () => {
    const before = newGame(level);
    const snapshot = structuredClone(before);
    step(level, before, { type: 'take', itemName: 'key' });
    expect(before).toEqual(snapshot);
  });

  it('takes and drops items, moving them between room and inventory', () => {
    let state = newGame(level);
    state = step(level, state, { type: 'take', itemName: 'the brass key' }).state;
    expect(state.inventory).toEqual(['key']);
    state = step(level, state, { type: 'move', exit: 'e' }).state;
    const drop = step(level, state, { type: 'drop', itemName: 'key' });
    expect(drop.result.ok).toBe(true);
    expect(step(level, drop.state, { type: 'look' }).result).toMatchObject({ body: { items: ['Brass Key'] } });
  });

  it('refuses fixed items and unknown targets', () => {
    const state = newGame(level);
    expect(step(level, state, { type: 'take', itemName: 'statue' }).result).toMatchObject({ error: 'not_takeable' });
    expect(step(level, state, { type: 'examine', target: 'unicorn' }).result).toMatchObject({ error: 'unknown_target' });
    expect(step(level, state, { type: 'drop', itemName: 'key' }).result).toMatchObject({ error: 'not_carrying' });
  });

  it('counts actions but not look or inventory', () => {
    let state = newGame(level);
    for (const command of [{ type: 'look' }, { type: 'inventory' }, { type: 'examine', target: 'statue' }] as const) {
      state = step(level, state, command).state;
    }
    expect(state.actions).toBe(1);
  });
});
