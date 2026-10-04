// node --test examples/client-node
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createClient, format, run } from './quest.mjs';

/** A fake fetch that records requests and answers from a queue of [status, body, headers]. */
function fakeFetch(...answers) {
  const requests = [];
  const fetch = async (url, init) => {
    requests.push({ url, ...init, body: init.body && JSON.parse(init.body) });
    const [status, body, headers = {}] = answers.shift() ?? [200, {}];
    return { status, ok: status < 400, headers: new Headers(headers), json: async () => body };
  };
  return { fetch, requests };
}

const options = (fetch) => ({ url: 'https://quest.test/', key: 'qk_secret', fetch, sleep: async () => {} });

test('sends the key in the Authorization header', async () => {
  const { fetch, requests } = fakeFetch([200, { name: 'Briefing Room' }]);
  await createClient(options(fetch)).look();
  assert.equal(requests[0].url, 'https://quest.test/game/look');
  assert.equal(requests[0].method, 'GET');
  assert.equal(requests[0].headers.Authorization, 'ApiKey qk_secret');
});

test('posts the body fields from the spec', async () => {
  const { fetch, requests } = fakeFetch();
  const game = createClient(options(fetch));
  await game.examine('tablet');
  await game.move('north');
  await game.take('badge');
  await game.drop('mug');
  await game.use('crystal', 'console');
  await game.use('notebook');
  assert.deepEqual(
    requests.map((r) => [r.method, r.url.split('/game/')[1], r.body]),
    [
      ['POST', 'examine', { target: 'tablet' }],
      ['POST', 'move', { exit: 'north' }],
      ['POST', 'take', { itemName: 'badge' }],
      ['POST', 'drop', { itemName: 'mug' }],
      ['POST', 'use', { direct_object: 'crystal', indirect_object: 'console' }],
      ['POST', 'use', { direct_object: 'notebook' }],
    ],
  );
});

test('returns game errors instead of throwing', async () => {
  const error = { error: 'locked', message: 'You need an access badge.' };
  const { fetch } = fakeFetch([400, error]);
  assert.deepEqual(await createClient(options(fetch)).move('north'), error);
  assert.equal(format(error), '✗ locked: You need an access badge.');
});

test('waits for Retry-After on 429, then retries', async () => {
  const waits = [];
  const { fetch, requests } = fakeFetch([429, { error: 'rate_limited' }, { 'Retry-After': '3' }], [200, { inventory: [] }]);
  const game = createClient({ ...options(fetch), sleep: async (ms) => waits.push(ms) });
  assert.deepEqual(await game.inventory(), { inventory: [] });
  assert.deepEqual(waits, [3000]);
  assert.equal(requests.length, 2);
});

test('gives up after two retries', async () => {
  const limited = [429, { error: 'rate_limited', message: 'Too many requests' }, { 'Retry-After': '1' }];
  const { fetch, requests } = fakeFetch(limited, limited, limited);
  assert.equal((await createClient(options(fetch)).look()).error, 'rate_limited');
  assert.equal(requests.length, 3);
});

test('turns command lines into calls', async () => {
  const { fetch, requests } = fakeFetch();
  const game = createClient(options(fetch));
  await run(game, 'take Access Badge');
  await run(game, 'use crystal console');
  assert.deepEqual(requests.map((r) => r.body), [{ itemName: 'Access Badge' }, { direct_object: 'crystal', indirect_object: 'console' }]);
  assert.throws(() => run(game, 'dance'), /Unknown command/);
});

test('formats rooms and the final score', () => {
  assert.equal(format({ name: 'Corridor', description: 'Concrete.', items: [], exits: ['north', 'south'] }), 'Corridor\nConcrete.\nExits: north, south');
  assert.equal(format({ message: 'Level complete.', score: 100 }), 'Level complete.\nScore: 100');
});
