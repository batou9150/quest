import { describe, expect, it } from 'vitest';
import { newGame, step, type Command, type GameState, type Level, type StepResult } from '@quest/engine';
import { demoLevels } from './index.ts';

const [theRing, theDustWorld, theDerelict] = demoLevels as [Level, Level, Level];

function play(level: Level, commands: Command[], state: GameState = newGame(level), lang = 'en') {
  const results: StepResult[] = [];
  for (const command of commands) {
    const out = step(level, state, command, lang);
    state = out.state;
    results.push(out.result);
  }
  return { state, results };
}

const move = (exit: string): Command => ({ type: 'move', exit });
const take = (itemName: string): Command => ({ type: 'take', itemName });
const use = (direct_object: string, indirect_object?: string): Command => ({ type: 'use', direct_object, indirect_object });
const lastMessage = (results: StepResult[]) => (results.at(-1) as { body: { message: string } }).body.message;

const SOLUTIONS = new Map<Level, Command[]>([
  [
    theRing,
    [
      move('north'), move('east'), take('Access Badge'), take('crystal'), move('west'), move('north'),
      take('glyph notebook'), use('notebook'), use('crystal', 'console'), use('console'), move('down'), move('ring'),
    ],
  ],
  [
    theDustWorld,
    [
      take('kit'), use('kit'), move('east'), take('rope'), use('flask', 'well'), move('west'), move('south'),
      take('disc'), move('south'), use('disc', 'altar'), use('carvings'), take('crystal'), move('north'),
      move('north'), use('crystal', 'pedestal'), use('pedestal'), move('ring'),
    ],
  ],
  [
    theDerelict,
    [
      take('crowbar'), take('lamp'), use('crowbar', 'hatch'), move('north'), move('west'), take('cell'),
      use('battery', 'lamp'), move('east'), move('east'), move('down'), take('fuse'), move('up'),
      use('fuse', 'reactor'), use('valve'), use('reactor'), move('west'), move('north'), use('helm'), move('pod'),
    ],
  ],
]);

describe('demo levels', () => {
  it('are numbered 1, 2, 3 with unique ids', () => {
    expect(demoLevels.map((l) => l.number)).toEqual([1, 2, 3]);
    expect(new Set(demoLevels.map((l) => l.id)).size).toBe(3);
  });

  it.each(demoLevels.map((l) => [l.title, l] as const))('"%s" can be solved for full points', (_, level) => {
    const solution = SOLUTIONS.get(level)!;
    const { state, results } = play(level, solution);
    expect(results.filter((r) => !r.ok)).toEqual([]);
    expect(state.finished).toBe(true);
    expect(state.actions).toBeLessThanOrEqual(level.par);
    expect(results.at(-1)).toMatchObject({ body: { score: level.points } });
  });
});

/** The same solutions, typed with the French names. */
const FRENCH_SOLUTIONS = new Map<Level, Command[]>([
  [
    theRing,
    [
      move('north'), move('east'), take("le badge d'accès"), take('cristal'), move('west'), move('north'),
      take('carnet de glyphes'), use('carnet'), use('cristal', 'console'), use('console'), move('down'), move('ring'),
    ],
  ],
  [
    theDustWorld,
    [
      take('kit'), use('kit'), move('east'), take('corde'), use('gourde', 'puits'), move('west'), move('south'),
      take('disque'), move('south'), use('disque', 'autel'), use('gravures'), take('cristal'), move('north'),
      move('north'), use('cristal', 'piédestal'), use('piédestal'), move('ring'),
    ],
  ],
  [
    theDerelict,
    [
      take('pied-de-biche'), take('lampe'), use('pied-de-biche', 'trappe'), move('north'), move('west'), take('cellule'),
      use('batterie', 'lampe'), move('east'), move('east'), move('down'), take('fusible'), move('up'),
      use('fusible', 'réacteur'), use('vanne'), use('réacteur'), move('west'), move('north'), use('barre'), move('pod'),
    ],
  ],
]);

describe('demo levels in French', () => {
  it.each(demoLevels.map((l) => [l.title, l] as const))('"%s" is fully translated', (_, level) => {
    const fr = level.locales.fr!;
    expect(fr.title).toBeTruthy();
    expect(fr.summary).toBeTruthy();
    for (const [roomId, room] of Object.entries(level.world.rooms)) {
      const text = fr.rooms[roomId];
      expect(text?.name, roomId).toBeTruthy();
      expect(text?.description, roomId).toBeTruthy();
      expect(text?.descriptionWhen.length, roomId).toBe(room.descriptionWhen.length);
      for (const [dir, exit] of Object.entries(room.exits)) {
        if (exit.description) expect(text?.exits[dir]?.description, `${roomId}.${dir}`).toBeTruthy();
        if (exit.lockedMessage) expect(text?.exits[dir]?.lockedMessage, `${roomId}.${dir}`).toBeTruthy();
      }
    }
    for (const [itemId, item] of Object.entries(level.world.items)) {
      expect(fr.items[itemId]?.name, itemId).toBeTruthy();
      expect(fr.items[itemId]?.description, itemId).toBeTruthy();
      if (item.fixedMessage) expect(fr.items[itemId]?.fixedMessage, itemId).toBeTruthy();
    }
    expect(fr.rules.filter(Boolean)).toHaveLength(level.world.rules.length);
  });

  it.each(demoLevels.map((l) => [l.title, l] as const))('"%s" can be solved with the French names', (_, level) => {
    const { state, results } = play(level, FRENCH_SOLUTIONS.get(level)!, newGame(level), 'fr');
    expect(results.filter((r) => !r.ok)).toEqual([]);
    expect(state.finished).toBe(true);
    expect(results.at(-1)).toMatchObject({ body: { score: level.points, message: expect.stringContaining('Niveau terminé') } });
  });

  it('switches language mid-run', () => {
    const solution = SOLUTIONS.get(theRing)!;
    const half = play(theRing, solution.slice(0, 6));
    const { state, results } = play(theRing, solution.slice(6), half.state, 'fr');
    expect(state.finished).toBe(true);
    expect(results.at(-2)).toMatchObject({ body: { name: "Salle de l'anneau" } });
  });
});

describe('The Ring Beneath the Mountain', () => {
  const solution = SOLUTIONS.get(theRing)!;

  it('keeps the control room locked without the badge, whatever the case of the exit', () => {
    const { state, results } = play(theRing, [move('north'), move('NORTH'), move('n')]);
    expect(results.slice(1)).toEqual([
      expect.objectContaining({ ok: false, error: 'locked' }),
      expect.objectContaining({ ok: false, error: 'locked' }),
    ]);
    expect(state.roomId).toBe('corridor');
  });

  it('gives hints when the console is used too early', () => {
    const { results } = play(theRing, [...solution.slice(0, 7), use('console')]);
    expect(lastMessage(results)).toContain('dead');
  });

  it('accepts use X on Y in either order', () => {
    const swapped = solution.map((c) => (c.type === 'use' && c.indirect_object ? use('console', 'power crystal') : c));
    expect(play(theRing, swapped).state.finished).toBe(true);
  });

  it('lowers the score above par, never below 20%', () => {
    const detour = Array.from({ length: 12 }, () => ({ type: 'examine', target: 'mug' }) as const);
    expect(play(theRing, [...detour, ...solution]).results.at(-1)).toMatchObject({ body: { score: 80 } });
    const lost = Array.from({ length: 200 }, () => ({ type: 'examine', target: 'mug' }) as const);
    expect(play(theRing, [...lost, ...solution]).results.at(-1)).toMatchObject({ body: { score: 20 } });
  });

  it('rejects commands after the level is finished', () => {
    const { results } = play(theRing, [...solution, { type: 'look' }]);
    expect(results.at(-1)).toMatchObject({ ok: false, error: 'level_finished' });
  });
});

describe('The Dust World', () => {
  it('does not let you cross the dunes without water', () => {
    const { state, results } = play(theDustWorld, [move('south')]);
    expect(results[0]).toMatchObject({ ok: false, error: 'locked' });
    expect(state.roomId).toBe('platform');
  });

  it('needs the rope to fill the flask', () => {
    const { state, results } = play(theDustWorld, [take('kit'), use('kit'), move('east'), use('flask', 'well')]);
    expect(lastMessage(results)).toContain('far below');
    expect(state.inventory).toEqual(['flask']);
  });

  it('asks for the home address once the pedestal is powered', () => {
    const solution = SOLUTIONS.get(theDustWorld)!;
    const withoutCarving = solution.filter((c) => !(c.type === 'use' && c.direct_object === 'carvings'));
    const { results } = play(theDustWorld, withoutCarving.slice(0, -1));
    expect(lastMessage(results)).toContain('which symbols lead home');
  });
});

describe('The Derelict', () => {
  const solution = SOLUTIONS.get(theDerelict)!;

  it('needs light to enter the engine room', () => {
    const { results } = play(theDerelict, [...solution.slice(0, 4), move('east')]);
    expect(results.at(-1)).toMatchObject({ ok: false, error: 'locked' });
  });

  it('shuts the reactor down when started before the coolant', () => {
    const early = [...solution.slice(0, 13), use('reactor')];
    const { state, results } = play(theDerelict, early);
    expect(lastMessage(results)).toContain('shuts itself down');
    expect(state.flags).not.toContain('power_on');
  });

  it('keeps the bridge sealed until the reactor runs', () => {
    const { results } = play(theDerelict, [...solution.slice(0, 8), move('north')]);
    expect(results.at(-1)).toMatchObject({ ok: false, error: 'locked' });
  });
});
