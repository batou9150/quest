# Reference solutions

Facilitator material for the [workshop](../docs/WORKSHOP.md). Don't hand these out up front: participants learn by building their own. Show each one after the step it answers.

| Folder | Answers | What it shows |
|---|---|---|
| [`client-node/`](client-node) | Step 2: An LLM writes your client | The tiny client: one function per operation, errors as data, `Retry-After` on `429`, a replay mode. Node 18+, no dependencies. |
| [`agent-adk-python/`](agent-adk-python) | Step 3: Let an agent play | A minimal agent with Google ADK: tools built from `/openapi.json`, the key kept in tool code, a step budget, and the numbers to compare runs. |

Both are generic: they contain no level solution. Only the three public demo levels are mentioned here.

Run their tests (no game server and no LLM needed):

```bash
node --test examples/client-node/*.test.mjs
cd examples/agent-adk-python && pip install -e '.[test]' && pytest
```
