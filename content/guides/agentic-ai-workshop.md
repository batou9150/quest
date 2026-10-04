---
order: 1
title: The agentic AI workshop
category: Workshop
summary: Learn how AI agents work by building one, in three steps: play by hand, have an LLM write your client, then let an agent play.
imageUrl: https://raw.githubusercontent.com/batou9150/quest/main/content/guides/images/agentic-ai-workshop.jpg
---
The Quantum Quest is a text adventure you play over HTTP. That makes it a good playground for learning agentic AI: the game is a set of tools, a level is a task with a clear goal, and the score measures how well it was done.

An **agent** is a loop: a model chooses a tool, reads the result, and chooses again until it reaches its goal. In this workshop you build up to one in three steps, each built on the one before.

## The three steps

1. [Step 1: Play by hand](/guides/playing-with-the-api). Play the first level in the browser, then send the same commands with `curl`. You learn the API, the rules and how the score works.
2. [Step 2: An LLM writes your client](/guides/writing-a-bot). Give an LLM the OpenAPI spec and have it write a small client, then a bot that replays your moves.
3. [Step 3: Let an agent play](/guides/letting-an-agent-play). Give an agent the game as tools and let it play alone. Measure it, change one thing, measure again.

Each step has learning objectives, an exercise, a checkpoint ("you're done when…") and ideas to go further.

## What the game teaches

Every game mechanic is a lesson about building agents:

| In the game | The lesson |
|---|---|
| `/openapi.json` | **Tool definitions.** A tool is a contract: name, description, parameters. The model only knows what the description says. |
| Error messages are hints | **Actionable errors.** An error that says what to do next lets an agent recover instead of looping. |
| Par and counted actions | **Every tool call has a cost.** Measure efficiency, not only success. |
| `429` and `X-RateLimit-Remaining` | **Retries and backoff.** The client must slow down, not crash. |
| "Never put the key in the prompt" | **Secrets stay out of the context.** The key lives in tool code; the model never sees it. |
| Event leaderboards | **Objective evaluation.** Compare prompts, models and tool descriptions on the same level, with a number. |

## What you need

- A browser and `curl`.
- Node.js 18+ or Python 3.11+ (or any language you like).
- An account on this site (sign in with Google or GitHub).
- An LLM: a chat assistant for step 2, and an API key for a model with tool calling for step 3.

New to text adventures? Read [What is a text adventure?](/guides/what-is-a-text-adventure) first: it takes two minutes.
