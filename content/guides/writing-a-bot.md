---
order: 4
title: Step 2: An LLM writes your client
category: Workshop
summary: Give an LLM the OpenAPI spec, have it write a client and a bot, then make the bot replay a level for you.
imageUrl: https://raw.githubusercontent.com/batou9150/quest/main/content/guides/images/writing-a-bot.jpg
---
In step 1 you played by hand. Now an LLM writes the code that plays: you stay in charge of the design and the review, the LLM types. This is step 2 of the [agentic AI workshop](/guides/agentic-ai-workshop).

## You will learn

- How an OpenAPI spec works as a contract between an API and its clients, human or LLM.
- How to brief an LLM so the code it writes is correct, and how to check it against the spec.
- How a client should handle the key, errors and rate limits.

## Exercise

1. Download [`/openapi.json`](/openapi.json).
2. Open your LLM (chat or coding assistant), paste the whole spec, then this brief. Change the language if you like:

> Here is the OpenAPI spec of a game API. Write a small Node.js client (Node 18+, no dependencies) with one function per operation. Read the base URL from `QUEST_URL` and the API key from `QUEST_KEY`; send the key as `Authorization: ApiKey <key>`. When a call fails, return the JSON body (`error` and `message`) instead of throwing, and print it. On `429`, wait for the `Retry-After` seconds and retry once. Add a small command-line entry point: `node quest.mjs look`, `node quest.mjs move north`, and so on.

3. Read the code before running it. Check every path, method and body field against the spec. If something is invented, tell the LLM what is wrong and ask for a fix.
4. Run it on your active level: `look`, `inventory`, then a failing action.
5. Ask the LLM to add a **replay** mode: it reads a list of commands from a file and plays them in order. Restart the first level from Level Select, write your winning moves from step 1 in the file, and replay them.

## You're done when…

- Your client replays the first level from a list of moves and prints the final score.
- The API key is read from the environment: it is in no file, prompt or screenshot.

## Going further

- **An explorer.** Ask for a bot that maps the world: from each room, try every exit, remember where it leads, and `examine` what it finds. Try it on **The Dust World**, then restart the level and replay only the moves you need.
- **Backoff.** Make the client watch `X-RateLimit-Remaining` and slow down before it hits `429`.
- **Counting.** Print the number of counted actions so far next to the level's par.

## Things to keep in mind

- `examine`, `move`, `take`, `drop` and `use` count as **actions** and lower your score past par. Explore on one run, then **restart** the level from Level Select and replay only the moves you need.
- Locked exits answer `400 locked` with a hint in `message`: log it, it tells you what to look for.
- Stay under the rate limit (see the `X-RateLimit-Remaining` header) and back off on `429`.

## Compare with a tiny client

Once yours works, compare it with this one. It is the smallest client that does the job (Node.js 18 or later, no dependencies):

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

What does yours do better? What does it do that it should not?

## The lessons

- **The spec is a contract.** The LLM wrote correct code because the spec says exactly what each operation takes and returns. In step 3, the same spec becomes the agent's tool definitions.
- **Secrets stay out of the context.** The key goes in an environment variable, never in the code you paste into a chat, and never in a prompt.
- **Retries and backoff.** A program calls much faster than you: it must respect `Retry-After` instead of failing or hammering the server.

Next: [Step 3: Let an agent play](/guides/letting-an-agent-play).
