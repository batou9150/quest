import { describe, expect, it } from 'vitest';
import { levelGraph, parseLevel } from './index.ts';

const level = parseLevel({
  id: 'tiny',
  number: 1,
  title: 'Tiny',
  points: 50,
  par: 5,
  world: {
    start: 'a',
    rooms: {
      a: { name: 'Hall', description: 'A hall.', items: ['key'], exits: { east: { to: 'b' } } },
      b: {
        name: 'Vault',
        description: 'A vault.',
        items: ['door'],
        exits: {
          west: { to: 'a' },
          out: { finish: true, requires: { flags: ['open'] } },
        },
      },
      c: { name: 'Attic', description: 'Nobody gets here.', exits: { down: { to: 'a' } } },
    },
    items: {
      key: { name: 'Brass Key', description: 'A key.' },
      door: { name: 'Door', description: 'A door.', takeable: false },
      gem: { name: 'Gem', description: 'Shiny.' },
    },
    rules: [
      { use: 'key', on: 'door', room: 'b', effects: [{ setFlag: 'open' }, { removeItem: 'key' }, { giveItem: 'gem' }], message: 'Click.' },
      { use: 'door', requires: { notFlags: ['open'] }, message: 'Locked.' },
    ],
  },
});

const edgesOf = (kind: string) =>
  levelGraph(level)
    .edges.filter((e) => e.kind === kind)
    .map((e) => `${e.source} -> ${e.target}${e.label ? ` [${e.label}]` : ''}`);

describe('levelGraph', () => {
  it('maps rooms, the finish and exits, marking locked exits', () => {
    const { nodes, edges } = levelGraph(level);
    expect(nodes.find((n) => n.id === 'room:a')).toMatchObject({ kind: 'room', label: 'Hall', start: true, reachable: true });
    expect(nodes.find((n) => n.id === 'finish')).toMatchObject({ kind: 'finish' });
    expect(edgesOf('exit')).toEqual([
      'room:a -> room:b [east]',
      'room:b -> room:a [west]',
      'room:b -> finish [out]',
      'room:c -> room:a [down]',
    ]);
    expect(edges.find((e) => e.target === 'finish')?.locked).toBe(true);
    const backward = edges.filter((e) => e.backward).map((e) => `${e.source} -> ${e.target}`);
    expect(backward).toEqual(['room:b -> room:a', 'room:c -> room:a']);
  });

  it('flags rooms that cannot be reached from the start', () => {
    expect(levelGraph(level).nodes.find((n) => n.id === 'room:c')?.reachable).toBe(false);
  });

  it('links items to rooms and to the actions that use them', () => {
    expect(edgesOf('contains')).toEqual(['room:a -> item:key', 'room:b -> item:door']);
    expect(edgesOf('uses')).toEqual(['item:key -> action:0 [use]', 'item:door -> action:0 [on]', 'item:door -> action:1 [use]']);
    const action = levelGraph(level).nodes.find((n) => n.id === 'action:0');
    expect(action).toMatchObject({ label: 'use Brass Key on Door', detail: 'in Vault', description: 'Click.' });
  });

  it('links actions to their effects and conditions', () => {
    expect(edgesOf('sets')).toEqual(['action:0 -> flag:open']);
    expect(edgesOf('removes')).toEqual(['action:0 -> item:key']);
    expect(edgesOf('gives')).toEqual(['action:0 -> item:gem']);
    expect(edgesOf('requires')).toEqual(['flag:open -> finish [opens out]']);
    expect(edgesOf('forbids')).toEqual(['flag:open -> action:1 [unless]']);
  });
});
