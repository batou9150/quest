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

describe('translations', () => {
  const translated = {
    ...base,
    world: {
      ...base.world,
      rooms: {
        ...base.world.rooms,
        a: { ...base.world.rooms.a, descriptionWhen: [{ flag: 'lit', text: 'It is lit.' }] },
      },
      rules: [
        { use: 'key', on: 'statue', effects: [{ setFlag: 'lit' }], message: 'The statue lights up.' },
        { use: 'statue', message: 'It stares back.' },
      ],
    },
    locales: {
      fr: {
        title: 'Minuscule',
        rooms: {
          a: { name: 'Salle A', descriptionWhen: [{ flag: 'lit', text: 'Elle est éclairée.' }] },
          b: { exits: { west: { description: 'Vers la salle A.' } } },
        },
        items: { key: { name: 'Clé en laiton', aliases: ['clé'] } },
        rules: [{ message: "La statue s'illumine." }],
      },
    },
  };
  const level = parseLevel(translated);

  it('answers in the requested language, falling back to English for what is not translated', () => {
    let state = newGame(level);
    expect(step(level, state, { type: 'look' }, 'fr').result).toMatchObject({
      body: { name: 'Salle A', description: 'A.', items: ['Clé en laiton', 'Statue'], exits: ['east'] },
    });
    state = step(level, state, { type: 'take', itemName: 'la clé' }, 'fr').state;
    const use = step(level, state, { type: 'use', direct_object: 'key', indirect_object: 'statue' }, 'fr');
    expect(use.result).toMatchObject({ body: { message: "La statue s'illumine." } });
    expect(step(level, use.state, { type: 'look' }, 'fr').result).toMatchObject({ body: { description: 'A. Elle est éclairée.' } });
    expect(step(level, use.state, { type: 'use', direct_object: 'statue' }, 'fr').result).toMatchObject({
      body: { message: 'It stares back.' },
    });
  });

  it('understands English and translated names, and keeps English for other languages', () => {
    const state = newGame(level);
    expect(step(level, state, { type: 'take', itemName: 'brass key' }, 'fr').result).toMatchObject({
      body: { message: 'Pris : Clé en laiton.' },
    });
    expect(step(level, state, { type: 'take', itemName: 'key' }, 'de').result).toMatchObject({ body: { message: 'Taken: Brass Key.' } });
  });

  it('translates engine messages and default texts', () => {
    const state = newGame(level);
    expect(step(level, state, { type: 'take', itemName: 'statue' }, 'fr').result).toMatchObject({
      error: 'not_takeable',
      message: 'Impossible de le déplacer.',
    });
    expect(step(level, state, { type: 'move', exit: 'up' }, 'fr').result).toMatchObject({
      error: 'unknown_exit',
      message: "Impossible d'aller « up ». Sorties : east.",
    });
    expect(step(level, state, { type: 'examine', target: 'east' }, 'fr').result).toMatchObject({
      body: { description: 'Rien de particulier.' },
    });
    expect(step(level, state, { type: 'examine', target: 'autour' }, 'fr').result).toMatchObject({ body: { description: 'A.' } });
  });

  it('reports translations that do not match the level', () => {
    const broken = structuredClone(translated) as any;
    broken.locales.fr.rooms.ghost = { name: 'Fantôme' };
    broken.locales.fr.rooms.a.descriptionWhen[0].flag = 'dark';
    broken.locales.fr.rooms.b.exits.north = { description: '?' };
    broken.locales.fr.items.ghost = { name: 'Fantôme' };
    broken.locales.fr.rules = [null, null, { message: 'Trop.' }];
    broken.locales.en = {};
    expect(() => parseLevel(broken)).toThrow(
      /flag "dark" should be "lit"[\s\S]*unknown exit "north"[\s\S]*unknown room "ghost"[\s\S]*unknown item "ghost"[\s\S]*more rules[\s\S]*English is the base/,
    );
  });
});
