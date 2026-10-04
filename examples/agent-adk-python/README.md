# Minimal agent (Python, Google ADK)

The reference answer to *Step 3: Let an agent play*. **Any framework works**: LangChain, LlamaIndex, the OpenAI Agents SDK, the Claude Agent SDK, Spring AI, or plain function calling with your provider's SDK. ADK is one choice; the ideas are the same everywhere.

## What it shows

| File | Lesson |
|---|---|
| `quest_agent/tools.py` | **Tool definitions.** Reads `/openapi.json` and builds one tool per operation: `operationId` → name, summary and description → description, request body schema → parameters. ADK's `OpenAPIToolset` does it in one line; this file does it by hand so the mapping is visible. |
| `quest_agent/game.py` | **Secrets out of the context.** The API key is read from `QUEST_KEY` and added to each request here; the model never sees it. **Retries and backoff:** `429` is handled with `Retry-After`, the model never sees it either. **Actionable errors:** game errors are returned to the model as data. |
| `quest_agent/agent.py` | A generic goal prompt (no level knowledge), and a **step budget** that stops the run after `--max-steps` tool calls. |
| `quest_agent/__main__.py` | **Evaluation.** Prints every tool call, then the score, counted actions and tool calls of the run. |

## Run it

Python 3.11+.

```bash
cd examples/agent-adk-python
python -m venv .venv && . .venv/bin/activate
pip install -e .

export QUEST_URL=https://<your-instance>
export QUEST_KEY=qk_...                 # from API Access on the site
export GOOGLE_API_KEY=...               # a Gemini API key (or set up Vertex AI, see the ADK docs)
export QUEST_MODEL=gemini-3.8-flash     # optional

python -m quest_agent --max-steps 50
```

Start the level from **Level Select** first: the agent plays your active level. To compare runs, restart the level before each one.

```
→ look({})
  {"name": "Ring Platform", "description": "You stumble out of the ring onto a stone platform. ...
→ examine({"target": "Dialing Pedestal"})
  ...
Level complete. Score: 120.

model:           gemini-3.8-flash
score:           120
counted actions: 36
tool calls:      45
```

That is a real first run on **The Dust World** (par 20, 200 points): a baseline to beat, not a target. With `QUEST_URL` and `QUEST_KEY` set, `adk web` also works from this folder, to watch the agent's events in a browser.

Other models: ADK can call non-Gemini models through LiteLLM (`model=LiteLlm(model="provider/model")` in `agent.py`).

## Ideas to improve it

Change one thing at a time and compare the numbers:

- Rewrite the instruction: ask it to plan before acting, or to avoid `examine` on what it already knows.
- Rewrite a tool description in `tools.py` (for example, explain that exits can be examined and used).
- Try a smaller or a larger model.
- Lower `--max-steps` and see what the agent gives up first.

## Tests

No game server and no LLM: the game API is mocked with `respx`, and the agent loop runs with a scripted model.

```bash
pip install -e '.[test]'
pytest
```
