import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono, type Context } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { csrf } from 'hono/csrf';
import { HTTPException } from 'hono/http-exception';
import { secureHeaders } from 'hono/secure-headers';
import { identify } from './auth/session.ts';
import { HttpError, log, type AppEnv, type Deps } from './http.ts';
import openapi from '../openapi.json' with { type: 'json' };
import { admin } from './routes/admin.ts';
import { auth } from './routes/auth.ts';
import { game } from './routes/game.ts';
import { me } from './routes/me.ts';
import { publicRoutes } from './routes/public.ts';

export function createApp(deps: Deps) {
  const app = new Hono<AppEnv>();

  app.use('*', async (c, next) => {
    const start = performance.now();
    c.set('deps', deps);
    await next();
    if (c.req.path.startsWith('/assets/')) return;
    log(c.res.status >= 500 ? 'ERROR' : 'INFO', `${c.req.method} ${c.req.path} ${c.res.status}`, {
      httpRequest: {
        requestMethod: c.req.method,
        requestUrl: c.req.path,
        status: c.res.status,
        latency: `${((performance.now() - start) / 1000).toFixed(3)}s`,
        userAgent: c.req.header('User-Agent'),
      },
    });
  });
  app.use(
    '*',
    secureHeaders({
      contentSecurityPolicy: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'"],
        frameAncestors: ["'none'"],
      },
    }),
  );
  app.use('*', csrf({ origin: deps.config.publicUrl }));
  app.use('*', bodyLimit({ maxSize: 512 * 1024 }));
  for (const prefix of ['/api/*', '/auth/*', '/game/*']) app.use(prefix, identify);

  app.get('/healthz', (c) => c.text('ok'));
  app.get('/openapi.json', (c) => c.json(openapi));
  app.route('/auth', auth);
  app.route('/api', publicRoutes);
  app.route('/api', me);
  app.route('/api/admin', admin);
  app.route('/game', game);
  app.all('/api/*', () => {
    throw new HttpError(404, 'not_found', 'No such endpoint');
  });
  app.all('/game/*', () => {
    throw new HttpError(404, 'not_found', 'No such game endpoint. See /openapi.json');
  });

  // The React app: hashed assets cached forever, every other GET falls back to index.html.
  const indexPath = join(deps.config.webDist, 'index.html');
  if (existsSync(indexPath)) {
    const index = readFileSync(indexPath, 'utf8');
    const html = (c: Context) => c.html(index, 200, { 'Cache-Control': 'no-cache' });
    app.get('/', html);
    app.use('/assets/*', async (c, next) => {
      await next();
      if (c.res.status === 200) c.header('Cache-Control', 'public, max-age=31536000, immutable');
    });
    app.use('*', serveStatic({ root: deps.config.webDist }));
    app.get('*', html);
  }

  app.onError((err, c) => {
    if (err instanceof HttpError) return c.json({ error: err.code, message: err.message, ...err.extra }, err.status);
    if (err instanceof HTTPException) {
      return c.json({ error: 'http_error', message: err.message || 'Request refused' }, err.status);
    }
    log('ERROR', err.stack ?? String(err), { path: c.req.path });
    return c.json({ error: 'internal', message: 'Internal error' }, 500);
  });
  app.notFound((c) => c.json({ error: 'not_found', message: 'Not found' }, 404));
  return app;
}
