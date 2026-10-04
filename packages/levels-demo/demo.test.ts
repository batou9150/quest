import { describe, expect, it } from 'vitest';
import { newGame, step, type Command, type GameState } from '@quest/engine';
import { demoLevel } from './index.ts';

function play(commands: Command[], state: GameState = newGame(demoLevel)) {
  const results = [];
  for (const command of commands) {
    const out = step(demoLevel, state, command);
    state = out.state;
    results.push(out.result);
  }
  return { state, results };
}

const SOLUTION: Command[] = [
  { type: 'move', exit: 'north' },
  { type: 'move', exit: 'east' },
  { type: 'take', itemName: 'Access Badge' },
  { type: 'take', itemName: 'crystal' },
  { type: 'move', exit: 'west' },
  { type: 'move', exit: 'north' },
  { type: 'take', itemName: 'glyph notebook' },
  { type: 'use', direct_object: 'notebook' },
  { type: 'use', direct_object: 'crystal', indirect_object: 'console' },
  { type: 'use', direct_object: 'console' },
  { type: 'move', exit: 'down' },
  { type: 'move', exit: 'ring' },
];

describe('demo level', () => {
  it('can be solved, with full points at par', () => {
    const { state, results } = play(SOLUTION);
    expect(results.every((r) => r.ok)).toBe(true);
    expect(state.finished).toBe(true);
    expect(results.at(-1)).toMatchObject({ ok: true, body: { score: 100 } });
  });

  it('keeps the control room locked without the badge, whatever the case of the exit', () => {
    const { state, results } = play([
      { type: 'move', exit: 'north' },
      { type: 'move', exit: 'NORTH' },
      { type: 'move', exit: 'n' },
    ]);
    expect(results.slice(1)).toEqual([
      expect.objectContaining({ ok: false, error: 'locked' }),
      expect.objectContaining({ ok: false, error: 'locked' }),
    ]);
    expect(state.roomId).toBe('corridor');
  });

  it('gives hints when the console is used too early', () => {
    const { results } = play([...SOLUTION.slice(0, 7), { type: 'use', direct_object: 'console' }]);
    expect(results.at(-1)).toMatchObject({ ok: true, body: { message: expect.stringContaining('dead') } });
  });

  it('accepts use X on Y in either order', () => {
    const swapped = SOLUTION.map((c) =>
      c.type === 'use' && c.indirect_object ? { ...c, direct_object: 'console', indirect_object: 'power crystal' } : c,
    );
    expect(play(swapped).state.finished).toBe(true);
  });

  it('lowers the score above par, never below 20%', () => {
    const detour: Command[] = Array.from({ length: 10 }, () => ({ type: 'examine', target: 'mug' }) as const);
    expect(play([...detour, ...SOLUTION]).results.at(-1)).toMatchObject({ body: { score: 84 } });
    const lost: Command[] = Array.from({ length: 200 }, () => ({ type: 'examine', target: 'mug' }) as const);
    expect(play([...lost, ...SOLUTION]).results.at(-1)).toMatchObject({ body: { score: 20 } });
  });

  it('rejects commands after the level is finished', () => {
    const { results } = play([...SOLUTION, { type: 'look' }]);
    expect(results.at(-1)).toMatchObject({ ok: false, error: 'level_finished' });
  });
});
