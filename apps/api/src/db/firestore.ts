import { Firestore, type Query } from '@google-cloud/firestore';
import type { Db, Doc, ListOptions, Tx } from './db.ts';

/** Uses Application Default Credentials (the Cloud Run service account), or FIRESTORE_EMULATOR_HOST. */
export class FirestoreDb implements Db {
  constructor(private readonly fs: Firestore = new Firestore({ ignoreUndefinedProperties: true })) {}

  async get<T>(path: string): Promise<T | null> {
    const snap = await this.fs.doc(path).get();
    return snap.exists ? (snap.data() as T) : null;
  }

  async set<T extends object>(path: string, data: T): Promise<void> {
    await this.fs.doc(path).set(data);
  }

  async merge(path: string, data: Record<string, unknown>): Promise<void> {
    await this.fs.doc(path).set(data, { merge: true });
  }

  async delete(path: string): Promise<void> {
    await this.fs.doc(path).delete();
  }

  async list<T>(collection: string, options: ListOptions = {}): Promise<Doc<T>[]> {
    let query: Query = this.fs.collection(collection);
    for (const [field, op, value] of options.where ?? []) query = query.where(field, op, value);
    if (options.orderBy) query = query.orderBy(...options.orderBy);
    if (options.startAfter !== undefined) query = query.startAfter(options.startAfter);
    if (options.limit !== undefined) query = query.limit(options.limit);
    const snap = await query.get();
    return snap.docs.map((d) => ({ id: d.id, data: d.data() as T }));
  }

  async deleteCollection(collection: string): Promise<void> {
    const refs = await this.fs.collection(collection).listDocuments();
    const writer = this.fs.bulkWriter();
    for (const ref of refs) void writer.delete(ref);
    await writer.close();
  }

  transaction<R>(fn: (tx: Tx) => Promise<R>): Promise<R> {
    return this.fs.runTransaction(async (t) =>
      fn({
        get: async (path) => {
          const snap = await t.get(this.fs.doc(path));
          return snap.exists ? (snap.data() as never) : null;
        },
        set: (path, data) => void t.set(this.fs.doc(path), data),
        merge: (path, data) => void t.set(this.fs.doc(path), data, { merge: true }),
        delete: (path) => void t.delete(this.fs.doc(path)),
      }),
    );
  }
}
