# Writing levels

A level is one JSON file, validated by `parseLevel()` in `packages/engine/src/schema.ts`. The public examples are the three demo levels in [`packages/levels-demo/levels/`](../packages/levels-demo/levels), from simple to harder: a tutorial, a level with item combinations, and a six-room level where the order of actions matters.

Keep real levels **out of this repository**: it is public, and a level file is its own solution. Keep them in a private folder or repository and upload them with:

```bash
npm run levels:push -- path/to/level.json --dry-run       # validate only
QUEST_URL=https://… QUEST_API_KEY=qk_… npm run levels:push -- path/to/*.json --publish
```

or with the *Upload level* button on the admin Levels page. New levels start unpublished.

## Structure

```jsonc
{
  "id": "my-level",          // lowercase, digits, - and _
  "number": 2,               // order in Level Select; each level unlocks the next
  "title": "…",
  "summary": "…",
  "points": 200,             // score when finished within par
  "par": 20,                 // counted actions for full points
  "penaltyPerAction": 5,     // per action over par; never below 20% of points
  "world": {
    "start": "room-id",
    "rooms": { "room-id": Room, … },
    "items": { "item-id": Item, … },
    "rules": [ Rule, … ]
  }
}
```

**Room**
| Field | Meaning |
|---|---|
| `name`, `description` | Shown by `look` |
| `descriptionWhen` | `[{ "flag": "x", "text": "…" }]`: sentences appended while a flag is set |
| `items` | Item ids lying here at the start |
| `exits` | `{ "north": Exit, … }`. Any name works (`north`, `down`, `ring`); `n s e w u d` are shortcuts for the usual directions |

**Exit**: `to` (room id) or `"finish": true` (leaving through it completes the level; at least one is required), `description` (for `examine`), `requires` (a Condition) and `lockedMessage`.

**Item**: `name` (what players see and type), `aliases`, `description`, `takeable` (default true), `fixedMessage` (when taking a fixed item fails).

**Rule**: what `use` does. `use <use> [on <on>]` runs the first rule whose `use`/`on` match (either order), whose `room` matches (if given), and whose `requires` holds. Its `effects` run and its `message` is returned. With no matching rule the answer is "Nothing happens."

| Effect | |
|---|---|
| `{ "setFlag": "x" }` / `{ "clearFlag": "x" }` | Flags drive conditions and `descriptionWhen` |
| `{ "giveItem": "id" }` | Put an item in the inventory |
| `{ "spawnItem": "id" }` | Put an item in the current room |
| `{ "removeItem": "id" }` | Remove an item from everywhere (used up) |

**Condition**: `{ "flags": [], "notFlags": [], "inventory": [] }`, all must hold.

Order rules from most to least specific: put the success rule first and hint rules ("the console is dead") after it, guarded with `notFlags`.

## Checklist

- Every room is reachable, and the finishing exit is reachable.
- `par` is the length of the shortest solution plus a little slack; count only examine, move, take, drop and use.
- Each locked exit and failed `use` gives a hint, not just "Nothing happens."
- Add a playthrough test like [`packages/levels-demo/demo.test.ts`](../packages/levels-demo/demo.test.ts) in your private levels folder.
