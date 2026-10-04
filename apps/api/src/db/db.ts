/**
 * Minimal document-store interface implemented by Firestore (production) and memory (dev, tests).
 * Paths are Firestore-style: "users/abc", "users/abc/progress/level-1".
 * Values must be plain JSON (dates are ISO strings).
 */
export type Filter = [field: string, op: '==' | '<' | '<=' | '>' | '>=', value: string | number | boolean | null];

export interface ListOptions {
  where?: Filter[];
  orderBy?: [field: string, direction: 'asc' | 'desc'];
  limit?: number;
  /** Value of the `orderBy` field to start after (cursor pagination). */
  startAfter?: string | number;
}

export interface Doc<T> {
  id: string;
  data: T;
}

/** Inside a transaction every read must happen before the first write (a Firestore rule). */
export interface Tx {
  get<T>(path: string): Promise<T | null>;
  set<T extends object>(path: string, data: T): void;
  merge(path: string, data: Record<string, unknown>): void;
  delete(path: string): void;
}

export interface Db {
  get<T>(path: string): Promise<T | null>;
  set<T extends object>(path: string, data: T): Promise<void>;
  merge(path: string, data: Record<string, unknown>): Promise<void>;
  delete(path: string): Promise<void>;
  list<T>(collection: string, options?: ListOptions): Promise<Doc<T>[]>;
  /** Deletes every document of a collection (not its sub-collections). */
  deleteCollection(collection: string): Promise<void>;
  /** Runs `fn` atomically; it may be retried on contention, so it must not have side effects. */
  transaction<R>(fn: (tx: Tx) => Promise<R>): Promise<R>;
}
