# Running a workshop

This guide is for the facilitator. Participants read the **Workshop** guides on the site (sources in [`content/guides/`](../content/guides)); this page covers what they don't see: setup, timing, the hints to give, the pitfalls and the debrief.

## What participants learn

The workshop teaches agentic AI by building up to it in three steps:

1. **Play by hand** (guide *Step 1: Play by hand*): the browser, then `curl`. Participants learn the API, the rules and how the score works.
2. **LLM as coding assistant** (guide *Step 2: An LLM writes your client*): an LLM writes a client from `/openapi.json`; participants run it and fix it.
3. **LLM as agent** (guide *Step 3: Let an agent play*): an agent gets the game as tools, plays alone, and participants improve it using its score.

Each game mechanic is an agent engineering lesson. Name it when it shows up, and come back to it in the debrief:

| In the game | The lesson |
|---|---|
| `/openapi.json` | **Tool definitions.** A tool is a contract: name, description, parameters. The model only knows what the description says. |
| Error messages are hints (`"You need an access badge."`) | **Actionable errors.** An error that says what to do next lets an agent recover instead of looping. |
| Par and counted actions | **Every tool call has a cost.** Measure efficiency, not only success. |
| `429`, `Retry-After`, `X-RateLimit-Remaining` | **Retries and backoff.** Agents call tools in bursts; the client must slow down, not crash. |
| "Never put the key in the prompt" | **Secrets stay out of the context.** The key lives in tool code; the model never sees it. |
| Event leaderboard | **Objective evaluation.** Compare prompts, models and tool descriptions on the same level, with a number. |

## Formats and agenda

| Block | 2 h | Half day (3 h 30) | Hackathon (1 day) |
|---|---|---|---|
| Intro: what an agent is, the game, the three steps | 10 min | 15 min | 20 min |
| Step 1: play by hand, demo level 1 | 25 min | 40 min | 45 min |
| Step 2: an LLM writes the client | 30 min | 45 min | 60 min |
| Break | | 15 min | lunch |
| Step 3: an agent plays levels 2 and 3, then improve it | 40 min | 75 min | 30 min setup, then 3 h of team iteration |
| Debrief | 15 min | 20 min | 45 min (team demos, final ranking) |

- **2 h**: everyone does step 1 on level 1. In step 2 most people stop at a client that replays a list of moves. In step 3, one agent run on level 2 and one change is enough to have something to compare in the debrief.
- **Half day**: step 3 has time for several runs and a written comparison (prompt A vs B, model A vs B). Stretch goals are realistic.
- **Hackathon**: teams of 2 or 3. Create an event with the demo levels plus your own private levels. Rules to announce: the agent plays alone on the team's scored account (no human moves on it), every team plays the same levels, the event leaderboard decides. Ask each team to keep a run log (what they changed, score, actions, tool calls) for the demo.

The three demo levels (seeded on every instance) get harder: **The Ring Beneath the Mountain** (tutorial, 5 rooms, par 14), **The Dust World** (item combinations, par 20), **The Derelict** (6 rooms, the order of actions matters, par 24). Levels unlock in order: a player must finish one to start the next.

## Prerequisites

**Participant laptop**

- A browser and `curl` (or any HTTP client: Postman, HTTPie, Bruno).
- One language runtime for steps 2 and 3: Node.js 18+ or Python 3.11+ is enough.
- A Google or GitHub account to sign in to the site.

**LLM access**

- Step 2: any chat assistant or coding assistant that can read a pasted JSON file.
- Step 3: an API key for a model that supports tool calling (function calling), and an agent framework or SDK in the participant's language. Any provider works. Check the quota before the day: a free tier can run out after a few agent runs.
- Plan a fallback for people without LLM access: pair them with someone who has it, or let them write the bot by hand in step 2.

**Facilitator**

- An instance: your own deployment ([DEPLOY.md](DEPLOY.md)) or, for a small group on one network, `npm run dev` on your laptop (memory store: everything is lost on restart).
- An admin account (`ADMIN_EMAILS` gives the admin role at sign-in).
- A second, **non-admin** account for testing (see setup).

## Setup

**A week before**

1. Decide the format and the levels. For 2 h or half a day, the three demo levels are enough. For a hackathon, add private levels (see [LEVELS.md](LEVELS.md)): upload them with `npm run levels:push -- <files> --publish`, or the *Upload level* button on **Admin > Levels**. Never put them in this public repository: a level file is its own solution.
2. Check the published levels on **Admin > Levels**: their order is the order players unlock them.
3. Check the rate limit: `GAME_RATE_LIMIT` (default 60 calls per minute per user, per instance). 60 is fine for humans and for one agent per account; raise it if teams run agents in parallel on one account. On Cloud Run: `gcloud run services update quest --region europe-west1 --update-env-vars GAME_RATE_LIMIT=120`.

**The day before**

4. Create the event on **Admin > Events**: a title, dates that cover the whole session (a level only counts for an event while it is **ACTIVE**), and its levels. No levels selected means every level counts.
5. Test as a participant with the **non-admin** account: sign in, start the first level, generate an API key, play with `curl`, finish the level, and check the score on the event leaderboard. Admins can start any level, so an admin account hides the unlock order.
6. Run the reference solutions once against the instance (see [Reference solutions](#reference-solutions)).

**One hour before**

7. Open the site once to wake the instance (Cloud Run scales to zero, the first request is slow).
8. Put the site address and the event name on the first slide.

## Running each step

Give hints in order, from the softest; move to the next one only when people are stuck for a few minutes.

### Intro

Explain an agent in one sentence: a loop where a model chooses a tool, reads the result, and chooses again until it reaches a goal. Today's tools are the game commands; the goal is to leave the level in as few actions as possible. Show the three steps and the lessons table.

### Step 1: Play by hand

Goal: everyone finishes level 1 in the browser, then sends a few commands with `curl`.

Hints:

1. "Read the Mission Tablet." (`examine tablet`: it lists every step of the level.)
2. "When something fails, read the message: it says what is missing."
3. "`look` and `inventory` are free: use them as much as you like."
4. For `curl`: "Start the level in the browser first: the API plays your *active level*."

Point out the lessons as they happen: the error message that gave the answer (actionable errors), the score below 100 for those who wandered (cost per action), the `X-RateLimit-Remaining` header (`curl -i`).

### Step 2: An LLM writes your client

Goal: an LLM writes a small client from `/openapi.json`; participants run it, fix it, and make it replay their winning moves.

Hints:

1. "Paste the whole `/openapi.json` into the prompt, not a summary: the spec is the contract."
2. "Ask for one function per operation, the key read from an environment variable, and errors printed with their `message`."
3. "If the generated code invents an endpoint or a field, check it against the spec and tell the LLM what is wrong."
4. "To replay a level, restart it from Level Select first: a finished level answers `level_finished`."

Lessons to name: the spec as a contract, the key in the environment and never in code or prompts, backoff on `429`.

### Step 3: Let an agent play

Goal: an agent plays a level alone through tools; participants measure it, change one thing, and measure again.

Hints:

1. "Start small: seven tools (or the OpenAPI file), the goal prompt from the guide, and a cap on the number of steps."
2. "Print every tool call and its result: you need to see what the agent sees."
3. "If the agent loops, look at what it receives: is the error message passed to the model, or swallowed by your code?"
4. "Change one thing per run: the prompt, the model, or a tool description. Restart the level before each run."
5. "Count three numbers per run: score, counted actions, total tool calls (including the free ones)."

Lessons to name: tool descriptions are prompts, errors returned to the model are part of the prompt, the key stays in tool code, one number per run makes comparisons objective.

## Common pitfalls

| Symptom | Cause | Fix |
|---|---|---|
| `409 no_active_level` | No level started on this account | Start the level from Level Select in the browser, then call the API again |
| `401 invalid_api_key` after it worked | A new key was generated: the old one stops working | Use the latest key; one key per account |
| `403 level_locked` when starting a level | Levels unlock in order | Finish the previous level first |
| `400 level_finished` | The level is complete | Restart it from Level Select (**Restart** or **Replay**) |
| Score on the event leaderboard missing | The level was finished before the event started, after it ended, or is not in the event | Check the event dates and levels; finish the level again while the event is active |
| The agent's score and the human's score mix | One account is one leaderboard row (best score per level) | Use a separate account for the agent, or compare runs from the agent's own log |
| The API key appears in a prompt, a log or a screenshot | Key pasted into the prompt or printed by the code | Generate a new key on **API Access**; read it from an environment variable in tool code |
| Bursts of `429 rate_limited` | The agent or the bot calls without pause | Wait for `Retry-After` seconds; in a hackathon, raise `GAME_RATE_LIMIT` |
| The agent repeats the same failing call | The error is not passed back to the model, or the step cap is missing | Return `error` and `message` as the tool result; cap the number of steps |
| The agent burns actions on `examine` | The goal prompt does not mention the cost | Say in the prompt that actions are counted and `look`/`inventory` are free |
| The first request takes several seconds | Cold start | Open the site before the session |
| The LLM stops answering after a few runs | Provider quota or free-tier limit | Check quotas the day before; have a second model or pair participants |

## Debrief

Pick a few questions per lesson; ask for numbers, not impressions.

- **Tool definitions**: Did the agent use the tools as you expected? Which description did you change, and what did it change in the agent's behaviour? What would you add to the spec to help it?
- **Actionable errors**: Find an error message that saved the agent a few actions. What would happen with `400 Bad Request` and no message? How do your own APIs report errors?
- **Cost per call**: How many tool calls did your best run take, and how many counted actions? What did the agent spend that a human would not? What does a tool call cost in your real systems (latency, money, side effects)?
- **Retries and backoff**: Did anyone hit `429`? What did the agent do? Where should the retry live: in the tool code or in the model's reasoning?
- **Secrets**: Where was your API key during the session? What would a model do with a key it can read? What else should never reach the context?
- **Evaluation**: Which change improved your score the most? Was it the model, the prompt or a tool? Would the result hold on another level? How would you test an agent on a level it has never seen?

Close with the leaderboard and a short demo from the best agent run.

## Reference solutions

[`examples/`](../examples) holds reference solutions for the facilitator. Don't hand them out up front: show them after the step they answer.

- After step 2: [`examples/client-node/`](../examples/client-node), the tiny client, no dependencies.
- After step 3: [`examples/agent-adk-python/`](../examples/agent-adk-python), a minimal agent with Google ADK that loads `/openapi.json` as tools, keeps the key in tool code and prints its score. Any framework works; this is one example.

The agent is generic: it knows nothing about the levels. Use it to check your instance before the session and as a baseline score on the leaderboard.

## Variations

- **No LLM available**: do steps 1 and 2 by hand (write the client and an explorer bot without an assistant), and run the reference agent as a demo for step 3.
- **Self-study**: the three Workshop guides on the site work alone, in order. The checkpoints tell the reader when to move on.
- **Short demo (30 min)**: play level 1 live with `curl`, then run the reference agent on level 2 and discuss its log.
