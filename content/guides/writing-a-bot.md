---
order: 3
title: Writing a bot
category: API
summary: Script the game in a few lines, then let an AI agent play it for you.
---

Once you can play with `curl` ([Playing with the API](/guides/playing-with-the-api)), the next step is to let a program play.

## A tiny client

This Node.js script (Node 18 or later, no dependencies) wraps every game command in a function:

```js
// quest.mjs: run with  QUEST_URL=... QUEST_KEY=... node quest.mjs
const { QUEST_URL, QUEST_KEY } = process.env;

async function call(command, body) {
  const res = await fetch(`${QUEST_URL}/game/${command}`, {
    method: body ? 'POST' : 'GET',
    headers: { Authorization: `ApiKey ${QUEST_KEY}`, 'Content-Type': 'application/json' },
    body: body && JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) console.log(`  ✗ ${data.error}: ${data.message}`);
  return data;
}

const game = {
  look: () => call('look'),
  inventory: () => call('inventory'),
  examine: (target) => call('examine', { target }),
  move: (exit) => call('move', { exit }),
  take: (itemName) => call('take', { itemName }),
  drop: (itemName) => call('drop', { itemName }),
  use: (direct_object, indirect_object) => call('use', { direct_object, indirect_object }),
};

const room = await game.look();
console.log(room.name, '-', room.description);
for (const item of room.items ?? []) {
  console.log(`${item}: ${(await game.examine(item)).description}`);
}
```

## An explorer

A useful first bot maps the world: from each room, try every exit, remember where it leads, and `examine` everything along the way. Keep in mind:

- `examine`, `move`, `take`, `drop` and `use` count as **actions** and lower your score past par. Explore on one run, then **restart** the level from Level Select and replay only the moves you need.
- Locked exits answer `400 locked` with a hint in `message`: log it, it tells you what to look for.
- Stay under the rate limit (see the `X-RateLimit-Remaining` header) and back off on `429`.

## Letting an AI agent play

The game was designed for AI agents too. Give your agent:

1. The OpenAPI file, [`/openapi.json`](/openapi.json), as its tool definitions (most agent frameworks can load it directly), or the seven functions above as tools.
2. Your API key, in the tool code. Never paste it into the prompt.
3. A goal, for example:

> You are playing a text adventure through tools. Call `look` first. Read every description carefully, `examine` anything unusual, and pick up items that might be useful. When an action fails, read the error message: it is a hint. Your goal is to leave the level through its final exit, using as few actions as possible. `look` and `inventory` are free.

Watch its reasoning, then compare its score with yours on the **Events** leaderboards.
