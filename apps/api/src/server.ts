import { serve } from '@hono/node-server';
import { demoLevel } from '@quest/levels-demo';
import { createApp } from './app.ts';
import { loadConfig } from './config.ts';
import type { Db } from './db/db.ts';
import { log } from './http.ts';
import { paths, type LevelDoc } from './models.ts';
import { LevelCache } from './services/levels.ts';

const config = loadConfig();

async function createDb(): Promise<Db> {
  if (config.store === 'memory') return new (await import('./db/memory.ts')).MemoryDb();
  return new (await import('./db/firestore.ts')).FirestoreDb();
}

const db = await createDb();
if (config.seedDemo && !(await db.get(paths.level(demoLevel.id)))) {
  await db.set<LevelDoc>(paths.level(demoLevel.id), { ...demoLevel, published: true, updatedAt: new Date().toISOString() });
  log('INFO', `Seeded demo level ${demoLevel.id}`);
}

const app = createApp({ config, db, levels: new LevelCache(db), now: () => new Date() });
const server = serve({ fetch: app.fetch, port: config.port }, ({ port }) => {
  log('INFO', `Quest API listening on :${port} (store: ${config.store}${config.devLogin ? ', dev login ON' : ''})`);
});

// Cloud Run sends SIGTERM before stopping an instance.
process.on('SIGTERM', () => server.close(() => process.exit(0)));
