---
order: 5
title: Step 3: Let an agent play
category: Workshop
summary: Give an AI agent the game as tools, let it play a level alone, then improve it using its score.
imageUrl: https://raw.githubusercontent.com/batou9150/quest/main/content/guides/images/letting-an-agent-play.jpg
---
In step 2 the LLM wrote code and you ran it. Now the LLM decides: it chooses which tool to call, reads the result, and chooses again until it leaves the level. This is step 3 of the [agentic AI workshop](/guides/agentic-ai-workshop).

## You will learn

- How tools are described to a model, and why the description matters as much as the code.
- How an agent loop works: model, tool call, result, next call.
- How to keep a secret out of the model's context.
- How to evaluate an agent with a number, and improve it one change at a time.

## Exercise

1. **Pick a framework.** Any agent framework or SDK with tool calling works: use the one you know, in your language. Set a model API key in your environment.
2. **Give the agent the tools.** Either load [`/openapi.json`](/openapi.json) as tool definitions (most frameworks can do it directly), or wrap the functions of your step 2 client as tools.
3. **Keep the key in the tool code.** The tools read `QUEST_KEY` from the environment and add the `Authorization` header themselves. Never paste the key into the prompt: the model does not need it, and anything in the context can end up in a log or an answer.
4. **Give it a goal**, for example:

> You are playing a text adventure through tools. Call `look` first. Read every description carefully, `examine` anything unusual, and pick up items that might be useful. When an action fails, read the error message: it is a hint. Your goal is to leave the level through its final exit, using as few actions as possible. `look` and `inventory` are free.

The game answers in English unless your tools add `?lang=fr` to their calls for French, so the prompt can be in English too.

5. **Return errors to the model.** When a call fails, the tool should return the `error` and `message` as its result, not throw. The message is the hint the agent needs.
6. **Cap the steps.** Stop the loop after a fixed number of tool calls (50 is plenty for the demo levels) so a confused agent cannot run forever.
7. **Run it** on **The Dust World**: start the level from Level Select, then start the agent. Print every tool call and its result, and watch it play.
8. **Measure.** Write down three numbers: the score, the counted actions, and the total number of tool calls (free ones included).
9. **Change one thing**: the prompt, the model, or a tool description. Restart the level from Level Select and run again. Compare.

## You're done when…

- Your agent finishes a level alone, with no move from you.
- You have a table of at least two runs (what changed, score, actions, tool calls) and you can say which change helped.

## Going further

- Play **The Derelict**, where the order of actions matters.
- Reach the same score with a smaller, cheaper model.
- Rewrite one tool description and see whether the agent uses that tool differently.
- Handle `429` in the tool code, with `Retry-After`, so the agent never sees it.
- Compare your agent's score with the humans' on the **Events** leaderboard. Use a separate account for the agent if you want it to have its own row.

## The lessons

| What you did | The lesson |
|---|---|
| Loaded `/openapi.json` as tools | **Tool definitions.** A tool is a contract; its description is part of the prompt. |
| Passed error messages back to the model | **Actionable errors.** An agent recovers from errors that say what to do next. |
| Counted actions and tool calls | **Every tool call has a cost.** In real systems it is latency, money, or a side effect. |
| Handled `429` in the tool code | **Retries and backoff** belong in code, not in the model's reasoning. |
| Kept the key in the tool code | **Secrets stay out of the context.** |
| Compared runs on the same level | **Objective evaluation.** One number per run, one change at a time. |
