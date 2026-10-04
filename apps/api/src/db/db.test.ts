import { describe, expect, it } from 'vitest';
import type { Db } from './db.ts';
import { MemoryDb } from './memory.ts';

/** The same contract runs on MemoryDb, and on Firestore when FIRESTORE_EMULATOR_HOST is set. */
const stores: Array<[string, () => Promise<Db>]> = [['memory', async () => new MemoryDb()]];
if (process.env.FIRESTORE_EMULATOR_HOST) {
  stores.push([
    'firestore emulator',
    async () => {
      const { Firestore } = await import('@google-cloud/firestore');
      const { FirestoreDb } = await import('./firestore.ts');
      const fs = new Firestore({ projectId: 'demo-quest', ignoreUndefinedProperties: true });
      await fetch(`http://${process.env.FIRESTORE_EMULATOR_HOST}/emulator/v1/projects/demo-quest/databases/(default)/documents`, {
        method: 'DELETE',
      });
      return new FirestoreDb(fs);
    },
  ]);
}

describe.each(stores)('Db contract: %s', (_, make) => {
  it('gets, sets, merges and deletes documents', async () => {
    const db = await make();
    expect(await db.get('users/a')).toBeNull();
    await db.set('users/a', { name: 'Ada', score: 1 });
    await db.merge('users/a', { score: 2 });
    expect(await db.get('users/a')).toEqual({ name: 'Ada', score: 2 });
    await db.delete('users/a');
    expect(await db.get('users/a')).toBeNull();
  });

  it('lists a collection with filters, order, limit and cursor, ignoring sub-collections', async () => {
    const db = await make();
    for (const [id, score] of [['a', 3], ['b', 1], ['c', 2], ['d', 5]] as const) {
      await db.set(`scores/${id}`, { score, even: score % 2 === 0 });
    }
    await db.set('scores/a/nested/x', { score: 100 });
    const ids = async (...args: Parameters<Db['list']>) => (await db.list(...args)).map((d) => d.id);
    expect(await ids('scores', { orderBy: ['score', 'desc'] })).toEqual(['d', 'a', 'c', 'b']);
    expect(await ids('scores', { orderBy: ['score', 'desc'], limit: 2, startAfter: 3 })).toEqual(['c', 'b']);
    expect(await ids('scores', { where: [['score', '>=', 2], ['score', '<', 5]], orderBy: ['score', 'asc'] })).toEqual(['c', 'a']);
    expect(await ids('scores', { where: [['even', '==', true]] })).toEqual(['c']);
    await db.deleteCollection('scores');
    expect(await ids('scores')).toEqual([]);
  });

  it('commits transaction writes together, and not at all on error', async () => {
    const db = await make();
    await db.set('counters/x', { n: 0 });
    await Promise.all(
      Array.from({ length: 5 }, () =>
        db.transaction(async (tx) => {
          const c = await tx.get<{ n: number }>('counters/x');
          tx.set('counters/x', { n: c!.n + 1 });
        }),
      ),
    );
    expect(await db.get('counters/x')).toEqual({ n: 5 });

    await expect(
      db.transaction(async (tx) => {
        tx.set('counters/y', { n: 1 });
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    expect(await db.get('counters/y')).toBeNull();
  });
});
