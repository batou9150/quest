import type { Db, Doc, ListOptions, Tx } from './db.ts';

/** In-memory Db for local development and tests. Data is lost on restart. */
export class MemoryDb implements Db {
  private docs = new Map<string, unknown>();
  private queue: Promise<unknown> = Promise.resolve();

  async get<T>(path: string): Promise<T | null> {
    const doc = this.docs.get(checkDocPath(path));
    return doc === undefined ? null : (structuredClone(doc) as T);
  }

  async set<T extends object>(path: string, data: T): Promise<void> {
    this.docs.set(checkDocPath(path), structuredClone(data));
  }

  async merge(path: string, data: Record<string, unknown>): Promise<void> {
    const current = (this.docs.get(checkDocPath(path)) as object | undefined) ?? {};
    this.docs.set(path, { ...current, ...structuredClone(data) });
  }

  async delete(path: string): Promise<void> {
    this.docs.delete(checkDocPath(path));
  }

  async list<T>(collection: string, options: ListOptions = {}): Promise<Doc<T>[]> {
    const depth = collection.split('/').length + 1;
    let docs: Doc<Record<string, unknown>>[] = [];
    for (const [path, data] of this.docs) {
      if (path.startsWith(`${collection}/`) && path.split('/').length === depth) {
        docs.push({ id: path.slice(collection.length + 1), data: data as Record<string, unknown> });
      }
    }
    for (const [field, op, value] of options.where ?? []) {
      docs = docs.filter(({ data }) => compare(data[field], op, value));
    }
    if (options.orderBy) {
      const [field, direction] = options.orderBy;
      const sign = direction === 'asc' ? 1 : -1;
      docs.sort((a, b) => sign * order(a.data[field], b.data[field]));
      if (options.startAfter !== undefined) {
        docs = docs.filter(({ data }) => sign * order(data[field], options.startAfter) > 0);
      }
    }
    if (options.limit !== undefined) docs = docs.slice(0, options.limit);
    return structuredClone(docs) as Doc<T>[];
  }

  async deleteCollection(collection: string): Promise<void> {
    for (const doc of await this.list(collection)) this.docs.delete(`${collection}/${doc.id}`);
  }

  /** Transactions run one at a time and commit their writes together, like Firestore. */
  transaction<R>(fn: (tx: Tx) => Promise<R>): Promise<R> {
    const run = async () => {
      const writes: Array<() => void> = [];
      const tx: Tx = {
        get: (path) => {
          if (writes.length) throw new Error('Transaction reads must happen before writes');
          return this.get(path);
        },
        set: (path, data) => void writes.push(() => this.docs.set(checkDocPath(path), structuredClone(data))),
        merge: (path, data) => void writes.push(() => void this.merge(path, data)),
        delete: (path) => void writes.push(() => this.docs.delete(checkDocPath(path))),
      };
      const result = await fn(tx);
      for (const write of writes) write();
      return result;
    };
    const result = this.queue.then(run, run);
    this.queue = result.catch(() => undefined);
    return result;
  }
}

function checkDocPath(path: string): string {
  if (path.split('/').length % 2 !== 0) throw new Error(`Not a document path: ${path}`);
  return path;
}

function order(a: unknown, b: unknown): number {
  if (a === b) return 0;
  if (a === undefined || a === null) return -1;
  if (b === undefined || b === null) return 1;
  return (a as number | string) < (b as number | string) ? -1 : 1;
}

function compare(actual: unknown, op: string, value: unknown): boolean {
  if (op === '==') return actual === value;
  if (actual === undefined || actual === null) return false;
  const c = order(actual, value);
  return op === '<' ? c < 0 : op === '<=' ? c <= 0 : op === '>' ? c > 0 : c >= 0;
}
