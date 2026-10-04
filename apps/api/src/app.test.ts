import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { demoLevel } from '@quest/levels-demo';
import type { LevelSummary, Me } from '@quest/shared';
import { createApp } from './app.ts';
import { loadConfig } from './config.ts';
import { MemoryDb } from './db/memory.ts';
import { paths, type LevelDoc } from './models.ts';
import { resetRateLimits } from './routes/game.ts';
import { LevelCache } from './services/levels.ts';

const NOW = new Date('2026-10-04T12:00:00Z');

async function setup(env: Record<string, string> = {}) {
  const config = loadConfig({ STORE: 'memory', DEV_LOGIN: 'true', ADMIN_EMAILS: 'boss@dev.local', WEB_DIST: '/nonexistent', ...env });
  const db = new MemoryDb();
  await db.set<LevelDoc>(paths.level(demoLevel.id), { ...demoLevel, published: true, updatedAt: NOW.toISOString() });
  const app = createApp({ config, db, levels: new LevelCache(db, 0), now: () => NOW });

  /** Logs in through /auth/dev and returns a client sending the session cookie. */
  async function login(name: string) {
    const res = await app.request('/auth/dev', { method: 'POST', body: JSON.stringify({ name }), headers: { 'Content-Type': 'application/json' } });
    expect(res.status).toBe(204);
    const cookie = res.headers.get('Set-Cookie')!.split(';')[0]!;
    const call = (path: string, init: { method?: string; body?: unknown; headers?: Record<string, string> } = {}) =>
      app.request(path, {
        method: init.method ?? (init.body === undefined ? 'GET' : 'POST'),
        body: init.body === undefined ? undefined : JSON.stringify(init.body),
        headers: { Cookie: cookie, 'Content-Type': 'application/json', ...init.headers },
      });
    const me = (await (await call('/api/me')).json()) as Me;
    return { call, me };
  }
  return { app, db, login };
}

const SOLUTION: Array<[string, Record<string, string>]> = [
  ['move', { exit: 'north' }],
  ['move', { exit: 'east' }],
  ['take', { itemName: 'badge' }],
  ['take', { itemName: 'crystal' }],
  ['move', { exit: 'west' }],
  ['move', { exit: 'north' }],
  ['take', { itemName: 'notebook' }],
  ['use', { direct_object: 'notebook' }],
  ['use', { direct_object: 'crystal', indirect_object: 'console' }],
  ['use', { direct_object: 'console' }],
  ['move', { exit: 'down' }],
];

beforeEach(() => resetRateLimits());

describe('auth', () => {
  it('creates a user on first login, named "<first> <last>"', async () => {
    const { login } = await setup();
    const { me } = await login('Ada Lovelace');
    expect(me).toMatchObject({ displayName: 'Ada Lovelace', firstName: 'Ada', role: 'player', totalScore: 0 });
  });

  it('makes ADMIN_EMAILS users admin', async () => {
    const { login } = await setup();
    expect((await login('Boss')).me.role).toBe('admin');
  });

  it('hides dev login when disabled, and refuses it in production', async () => {
    const { app } = await setup({ DEV_LOGIN: 'false' });
    const res = await app.request('/auth/dev', { method: 'POST', body: '{"name":"x"}', headers: { 'Content-Type': 'application/json' } });
    expect(res.status).toBe(404);
    expect(() => loadConfig({ NODE_ENV: 'production', DEV_LOGIN: 'true' })).toThrow();
  });

  it('logs out', async () => {
    const { login } = await setup();
    const { call } = await login('Ada');
    expect((await call('/auth/logout', { method: 'POST' })).status).toBe(204);
    expect((await call('/api/me')).status).toBe(401);
  });

  it('rejects cross-site form posts', async () => {
    const { login } = await setup();
    const { call } = await login('Ada');
    const res = await call('/api/me/api-key', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Origin: 'https://evil.example' },
    });
    expect(res.status).toBe(403);
  });
});

describe('game API', () => {
  it('needs an active level', async () => {
    const { login } = await setup();
    const { call } = await login('Ada');
    const res = await call('/game/look');
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ error: 'no_active_level' });
  });

  it('plays the demo level with an API key and records the score', async () => {
    const { app, login } = await setup();
    const { call } = await login('Ada');
    const { apiKey } = (await (await call('/api/me/api-key', { method: 'POST' })).json()) as { apiKey: string };
    expect((await call(`/api/levels/${demoLevel.id}/start`, { body: { reset: false } })).status).toBe(200);

    const agent = (verb: string, payload?: object) =>
      app.request(`/game/${verb}`, {
        method: payload ? 'POST' : 'GET',
        body: payload && JSON.stringify(payload),
        headers: { Authorization: `ApiKey ${apiKey}`, 'Content-Type': 'application/json' },
      });

    expect(await (await agent('look')).json()).toMatchObject({ name: 'Briefing Room', exits: ['north'] });
    for (const [verb, payload] of SOLUTION) expect((await agent(verb, payload)).status).toBe(200);
    const locked = await agent('move', { exit: 'nowhere' });
    expect(locked.status).toBe(400);
    expect(await locked.json()).toMatchObject({ error: 'unknown_exit' });

    const final = await (await agent('move', { exit: 'ring' })).json();
    expect(final).toMatchObject({ score: 100 });
    const levels = (await (await call('/api/levels')).json()) as LevelSummary[];
    expect(levels[0]).toMatchObject({ status: 'PLAYED', bestScore: 100 });
    expect(((await (await call('/api/me')).json()) as Me).totalScore).toBe(100);
    expect((await agent('look')).status).toBe(400);
  });

  it('revokes the previous API key when a new one is generated', async () => {
    const { app, login } = await setup();
    const { call } = await login('Ada');
    const first = ((await (await call('/api/me/api-key', { method: 'POST' })).json()) as { apiKey: string }).apiKey;
    await call('/api/me/api-key', { method: 'POST' });
    const res = await app.request('/game/look', { headers: { Authorization: `ApiKey ${first}` } });
    expect(res.status).toBe(401);
  });

  it('rate-limits per user', async () => {
    const { login } = await setup({ GAME_RATE_LIMIT: '3' });
    const { call } = await login('Ada');
    const statuses = [];
    for (let i = 0; i < 4; i++) statuses.push((await call('/game/look')).status);
    expect(statuses).toEqual([409, 409, 409, 429]);
  });
});

describe('levels and events', () => {
  it('locks a level until the previous one is completed, except for admins', async () => {
    const { db, login } = await setup();
    const second = { ...demoLevel, id: 'second', number: 2, title: 'Second' };
    await db.set<LevelDoc>(paths.level('second'), { ...second, published: true, updatedAt: NOW.toISOString() });
    const ada = await login('Ada');
    const levels = (await (await ada.call('/api/levels')).json()) as LevelSummary[];
    expect(levels.map((l) => l.status)).toEqual(['AVAILABLE', 'LOCKED']);
    expect((await ada.call('/api/levels/second/start', { body: {} })).status).toBe(403);
    expect((await (await login('Boss')).call('/api/levels/second/start', { body: {} })).status).toBe(200);
  });

  it('adds completed levels to the leaderboard of running events', async () => {
    const { login } = await setup();
    const boss = await login('Boss');
    const created = await boss.call('/api/admin/events', {
      body: { title: 'Launch', startTime: '2026-10-01T02:00:00+02:00', endTime: '2026-10-10T00:00:00Z' },
    });
    expect(created.status).toBe(201);
    const { id, status, startTime } = (await created.json()) as { id: string; status: string; startTime: string };
    expect(status).toBe('ACTIVE');
    expect(startTime).toBe('2026-10-01T00:00:00.000Z');

    const ada = await login('Ada');
    await ada.call(`/api/levels/${demoLevel.id}/start`, { body: {} });
    for (const [verb, payload] of [...SOLUTION, ['move', { exit: 'ring' }] as const]) {
      await ada.call(`/game/${verb}`, { body: payload });
    }
    const board = await (await ada.call(`/api/events/${id}/leaderboard`)).json();
    expect(board).toEqual([{ rank: 1, userId: ada.me.id, displayName: 'Ada', score: 100 }]);
  });
});

describe('admin', () => {
  it('is forbidden to players', async () => {
    const { login } = await setup();
    expect((await (await login('Ada')).call('/api/admin/users')).status).toBe(403);
  });

  it('manages roles but cannot demote itself', async () => {
    const { login } = await setup();
    const ada = await login('Ada');
    const boss = await login('Boss');
    expect((await boss.call(`/api/admin/users/${ada.me.id}`, { method: 'PATCH', body: { role: 'admin' } })).status).toBe(204);
    expect(((await (await ada.call('/api/admin/users')).json()) as { items: unknown[] }).items).toHaveLength(2);
    const self = await boss.call(`/api/admin/users/${boss.me.id}`, { method: 'PATCH', body: { role: 'player' } });
    expect(self.status).toBe(400);
  });

  it('bans users', async () => {
    const { login } = await setup();
    const ada = await login('Ada');
    const boss = await login('Boss');
    await boss.call(`/api/admin/users/${ada.me.id}`, { method: 'PATCH', body: { banned: true } });
    expect((await ada.call('/api/me')).status).toBe(403);
    expect((await ada.call('/api/events')).status).toBe(200);
  });

  it('validates uploaded levels and keeps new ones unpublished', async () => {
    const { login } = await setup();
    const boss = await login('Boss');
    const bad = await boss.call('/api/admin/levels/broken', { method: 'PUT', body: { id: 'broken', number: 2 } });
    expect(bad.status).toBe(400);
    expect(((await bad.json()) as { issues: string[] }).issues.length).toBeGreaterThan(0);

    const next = { ...demoLevel, id: 'next', number: 2 };
    expect((await boss.call('/api/admin/levels/next', { method: 'PUT', body: next })).status).toBe(201);
    expect(((await (await boss.call('/api/levels')).json()) as LevelSummary[]).map((l) => l.id)).toEqual([demoLevel.id]);
    await boss.call('/api/admin/levels/next', { method: 'PATCH', body: { published: true } });
    expect(((await (await boss.call('/api/levels')).json()) as LevelSummary[]).map((l) => l.id)).toEqual([demoLevel.id, 'next']);
  });

  it('publishes guides, keeping drafts private', async () => {
    const { app, login } = await setup();
    const boss = await login('Boss');
    const guide = { title: 'Intro', category: 'General', content: '# Hello', published: false };
    expect((await boss.call('/api/admin/guides/intro', { method: 'PUT', body: guide })).status).toBe(201);
    expect((await app.request('/api/guides/intro')).status).toBe(404);
    await boss.call('/api/admin/guides/intro', { method: 'PUT', body: { ...guide, published: true } });
    expect(await (await app.request('/api/guides/intro')).json()).toMatchObject({ content: '# Hello', author: 'Boss' });
  });
});

describe('web app', () => {
  it('serves index.html for / and app routes, assets with long caching, JSON 404s for APIs', async () => {
    const dist = mkdtempSync(join(tmpdir(), 'quest-web-'));
    mkdirSync(join(dist, 'assets'));
    writeFileSync(join(dist, 'index.html'), '<!doctype html><title>Quest</title>');
    writeFileSync(join(dist, 'assets', 'app-123.js'), 'console.log(1)');
    const { app } = await setup({ WEB_DIST: dist });

    for (const path of ['/', '/events', '/admin/users']) {
      const res = await app.request(path);
      expect(res.status).toBe(200);
      expect(await res.text()).toContain('<title>Quest</title>');
      expect(res.headers.get('Cache-Control')).toBe('no-cache');
    }
    const asset = await app.request('/assets/app-123.js');
    expect(asset.headers.get('Cache-Control')).toContain('immutable');
    const api = await app.request('/api/nope');
    expect(api.status).toBe(404);
    expect(await api.json()).toMatchObject({ error: 'not_found' });
  });
});
