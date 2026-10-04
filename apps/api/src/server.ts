import { serve } from '@hono/node-server';
import { createApp } from './app.ts';
import { loadConfig } from './config.ts';
import type { Db } from './db/db.ts';
import { log } from './http.ts';
import { seedContent } from './seed.ts';
import { LevelCache } from './services/levels.ts';

const config = loadConfig();

async function createDb(): Promise<Db> {
  if (config.store === 'memory') return new (await import('./db/memory.ts')).MemoryDb();
  return new (await import('./db/firestore.ts')).FirestoreDb();
}

const db = await createDb();
if (config.seedDemo) await seedContent(db, config.guidesDir, new Date());

const app = createApp({ config, db, levels: new LevelCache(db), now: () => new Date() });
const server = serve({ fetch: app.fetch, port: config.port }, ({ port }) => {
  log('INFO', `Quest API listening on :${port} (store: ${config.store}${config.devLogin ? ', dev login ON' : ''})`);
});

// Cloud Run sends SIGTERM before stopping an instance.
process.on('SIGTERM', () => server.close(() => process.exit(0)));
