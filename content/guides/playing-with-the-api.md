---
order: 3
title: Step 1: Play by hand
category: Workshop
summary: Play the first level in the browser, then with curl, one request per command. Learn the API, the rules and the score.
imageUrl: https://raw.githubusercontent.com/batou9150/quest/main/content/guides/images/playing-with-the-api.jpg
---
Before a program or an agent can play, you need to know the game yourself: what each command does, what the answers look like, and what makes a good score. This is step 1 of the [agentic AI workshop](/guides/agentic-ai-workshop).

## You will learn

- How the game works: rooms, items, exits, and how a level ends.
- How the score works: a *par* number of counted actions, and a penalty for each action beyond it.
- How to call the game API with `curl`: authentication, requests, answers and errors.

## Exercise

1. **Sign in**, open **Level Select** and start **The Ring Beneath the Mountain**. Play it in the browser (**Play** in the menu) until you leave the level. Note your score.
2. Get an API key and replay part of the level with `curl` (sections below). Restart the level from Level Select first: a finished level answers `level_finished`.
3. Make an action fail on purpose (open a locked door, take something fixed) and read the error.
4. Run one request with `curl -i` and find the `X-RateLimit-Remaining` header.

## You're done when…

- You finished the first level, and you can explain why your score is what it is.
- You played at least three commands with `curl`, including one that failed.

## Going further

- Finish the level at par or below (full points).
- Open [`/openapi.json`](/openapi.json) and find, for each command, its name, its parameters and the errors it can return.
- Play the second level, **The Dust World**, with `curl` only.

## 1. Get your API key

1. **Connect**, then open **Level Select** and **start** a level. The game API always acts on your *active level*: the one you started or resumed last.
2. Open **API Access** and click **Generate API key**. Copy it now: it is shown only once. You can generate a new one at any time; the old one stops working.

```bash
export QUEST_URL=https://<this-site>      # the address of this site
export QUEST_KEY=qk_...                    # your key
```

Every request sends the key in the `Authorization` header:

```
Authorization: ApiKey <your key>
```

## 2. Look around

```bash
curl -s "$QUEST_URL/game/look" -H "Authorization: ApiKey $QUEST_KEY"
```

```json
{
  "name": "Briefing Room",
  "description": "A windowless room deep inside the mountain. ...",
  "items": ["Mission Tablet", "Coffee Mug"],
  "exits": ["north"]
}
```

Add `?lang=fr` (or send `Accept-Language: fr`) to get the game texts in French: `/game/look?lang=fr`. Commands, exit names (`north`, `ring`...) and error codes stay in English, and item names can be typed in either language.

## 3. Act

Actions are `POST` requests with a small JSON body:

```bash
q() { curl -s "$QUEST_URL/game/$1" -H "Authorization: ApiKey $QUEST_KEY" -H 'Content-Type: application/json' ${2:+-d "$2"}; echo; }

q look
q inventory
q examine '{"target": "Mission Tablet"}'
q take    '{"itemName": "Coffee Mug"}'
q drop    '{"itemName": "Coffee Mug"}'
q move    '{"exit": "north"}'
q use     '{"direct_object": "Coffee Mug"}'
q use     '{"direct_object": "key", "indirect_object": "door"}'
```

Names are not case-sensitive, and both the item's name and a short alias usually work (`"Mission Tablet"` or `"tablet"`).

When a `move` takes you out of the level, the answer is your result instead of a room:

```json
{ "message": "You step through ... Level complete in 14 actions.", "score": 100 }
```

## 4. The score

Each level is worth a number of points if you finish it within its *par*. `examine`, `move`, `take`, `drop` and `use` are counted actions; every counted action beyond par costs a few points. `look` and `inventory` are free.

## 5. Errors

Errors come back with an HTTP status and a JSON body you can show as-is:

| Status | `error` | Meaning |
|---|---|---|
| 400 | `unknown_target`, `unknown_exit`, `locked`, `not_takeable`, `not_carrying` | The action failed in the game; read `message` for a hint |
| 400 | `level_finished` | Level complete: start it again from Level Select to replay |
| 401 | `invalid_api_key` | Missing, wrong or revoked key |
| 409 | `no_active_level` | Start a level from Level Select first |
| 429 | `rate_limited` | Too many calls: wait for the `Retry-After` seconds |

```json
{ "error": "locked", "message": "The badge reader blinks red. You need an access badge." }
```

Every response also carries `X-RateLimit-Limit` and `X-RateLimit-Remaining`: the calls you have left in the current minute.

## 6. The full specification

The complete OpenAPI description is at [`/openapi.json`](/openapi.json). Load it into Postman, Insomnia, or your favourite code generator. You will hand it to an LLM in the next step.

## The lessons

- **Error messages are hints.** "You need an access badge" tells you exactly what to do next. An agent reads errors the same way: the more actionable they are, the faster it recovers.
- **Every action has a cost.** Par turns "did it finish?" into "how well did it finish?". You will measure your agent with the same number.
- **Rate limits are part of the contract.** A human never hits 60 calls a minute; a program does. Keep `Retry-After` in mind for step 2.

Next: [Step 2: An LLM writes your client](/guides/writing-a-bot).
