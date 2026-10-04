---
order: 2
title: Playing with the API
category: API
summary: Get an API key and play a level with curl, one request per command.
imageUrl: https://raw.githubusercontent.com/batou9150/quest/main/content/guides/images/playing-with-the-api.jpg
---

Everything you can do in the browser terminal, you can do over HTTP. This guide uses `curl`, but any language works.

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

## 4. Errors

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

## 5. The full specification

The complete OpenAPI description is at [`/openapi.json`](/openapi.json). Load it into Postman, Insomnia, or your favourite code generator.
