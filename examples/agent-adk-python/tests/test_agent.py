"""The whole loop (model -> tool -> game -> model) with a scripted model: no LLM is called."""

from typing import AsyncGenerator

import pytest
from google.adk.models.base_llm import BaseLlm
from google.adk.models.llm_response import LlmResponse
from google.adk.runners import InMemoryRunner
from google.genai import types

from quest_agent.__main__ import play
from quest_agent.agent import build_agent

pytestmark = pytest.mark.anyio


class ScriptedLlm(BaseLlm):
    """Answers each turn with the next scripted tool call, and records what the model was shown."""

    script: list[tuple[str, dict]]
    seen: list = []

    async def generate_content_async(self, llm_request, stream=False) -> AsyncGenerator[LlmResponse, None]:
        self.seen.append(llm_request)
        name, args = self.script.pop(0) if self.script else ("look", {})
        part = types.Part(function_call=types.FunctionCall(name=name, args=args))
        yield LlmResponse(content=types.Content(role="model", parts=[part]))


def runner_for(game, script, max_steps=10):
    model = ScriptedLlm(model="scripted", script=script, seen=[])
    return InMemoryRunner(agent=build_agent(game, model=model, max_steps=max_steps), app_name="quest_agent"), model


async def test_plays_until_the_level_is_complete(api, game):
    api.get("/game/look").respond(json={"name": "Hall", "description": "A hall.", "items": [], "exits": ["out"]})
    api.post("/game/move").respond(json={"message": "Level complete in 1 actions.", "score": 100})
    runner, _ = runner_for(game, [("look", {}), ("move", {"exit": "out"})])
    log = []
    await play(runner, log=log.append)
    assert (game.score, game.actions, game.tool_calls) == (100, 1, 2)
    assert log[0] == "→ look({})"
    assert log[-1] == "Level complete. Score: 100."


async def test_error_messages_reach_the_model(api, game):
    api.post("/game/move").respond(400, json={"error": "locked", "message": "You need an access badge."})
    api.get("/game/look").respond(json={"name": "Hall", "description": "A hall.", "items": [], "exits": []})
    runner, model = runner_for(game, [("move", {"exit": "north"}), ("look", {})], max_steps=2)
    await play(runner, log=lambda _: None)
    shown = str([c.model_dump() for request in model.seen for c in request.contents])
    assert "You need an access badge." in shown


async def test_stops_at_the_step_budget(api, game):
    api.get("/game/look").respond(json={"name": "Hall", "description": "A hall.", "items": [], "exits": []})
    runner, _ = runner_for(game, [], max_steps=5)  # keeps calling look forever
    log = []
    await play(runner, log=log.append)
    assert game.tool_calls == 5
    assert not game.finished
    assert log[-1] == "Stopped after 5 tool calls (step budget)."
