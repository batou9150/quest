"""The agent: a model, the game tools, and a goal. It knows nothing about any level."""

import os

from google.adk.agents import Agent
from google.adk.models.llm_response import LlmResponse
from google.genai import types

from .game import GameClient
from .tools import GameToolset

DEFAULT_MODEL = "gemini-3.8-flash"

INSTRUCTION = """\
You are playing a text adventure through tools. Call `look` first.
Read every description carefully, `examine` anything unusual, and pick up items that might be useful.
When an action fails, read the error message: it is a hint.
Your goal is to leave the level through its final exit, using as few actions as possible.
`examine`, `move`, `take`, `drop` and `use` are counted actions; `look` and `inventory` are free.
When a move answers with a score, the level is complete: stop and report the score.
"""


def build_agent(game: GameClient, model=None, max_steps: int = 50) -> Agent:
    """`max_steps` caps the tool calls, so a confused agent cannot run forever."""

    def stop_when_done(callback_context, llm_request) -> LlmResponse | None:
        # Returning a response here skips the model call and ends the run.
        if game.finished:
            reason = f"Level complete. Score: {game.score}."
        elif game.tool_calls >= max_steps:
            reason = f"Stopped after {game.tool_calls} tool calls (step budget)."
        else:
            return None
        return LlmResponse(content=types.Content(role="model", parts=[types.Part(text=reason)]))

    return Agent(
        name="quest_player",
        model=model or os.environ.get("QUEST_MODEL", DEFAULT_MODEL),
        description="Plays The Quantum Quest through its HTTP API.",
        instruction=INSTRUCTION,
        tools=[GameToolset(game)],
        before_model_callback=stop_when_done,
    )


def game_from_env() -> GameClient:
    url, key = os.environ.get("QUEST_URL"), os.environ.get("QUEST_KEY")
    if not url or not key:
        raise SystemExit("Set QUEST_URL and QUEST_KEY (the key is read here, never put in the prompt).")
    return GameClient(url, key)


# `adk web` and `adk run` look for `root_agent`.
root_agent = build_agent(game_from_env()) if os.environ.get("QUEST_URL") else None
