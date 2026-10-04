import json

import pytest

from conftest import KEY, SPEC
from quest_agent.agent import INSTRUCTION, build_agent
from quest_agent.tools import GameToolset, tools_from_spec

pytestmark = pytest.mark.anyio


def test_one_tool_per_game_operation(game):
    tools = {t.name: t for t in tools_from_spec(SPEC, game)}
    assert sorted(tools) == ["drop", "examine", "inventory", "look", "move", "take", "use"]
    assert (tools["look"].method, tools["look"].path, tools["look"].parameters) == ("GET", "/game/look", None)
    assert tools["move"].method == "POST"


def test_declarations_come_from_the_spec(game):
    tools = {t.name: t for t in tools_from_spec(SPEC, game)}
    move = tools["move"]._get_declaration()
    assert "Move through an exit" in move.description
    assert move.parameters_json_schema["required"] == ["exit"]
    assert "description" in move.parameters_json_schema["properties"]["exit"]
    use = tools["use"]._get_declaration().parameters_json_schema
    assert set(use["properties"]) == {"direct_object", "indirect_object"}
    assert "$ref" not in json.dumps(use)


def test_the_key_never_reaches_the_model(game):
    declarations = [t._get_declaration().model_dump_json() for t in tools_from_spec(SPEC, game)]
    assert KEY not in INSTRUCTION
    assert not any(KEY in d for d in declarations)


def test_the_instruction_is_generic():
    # The agent must solve levels from what it reads, not from hardcoded knowledge.
    for word in ("badge", "crystal", "ring", "console", "north"):
        assert word not in INSTRUCTION.lower()


async def test_tools_call_the_api_with_the_model_arguments(api, game):
    route = api.post("/game/take").respond(json={"message": "Taken."})
    take = {t.name: t for t in tools_from_spec(SPEC, game)}["take"]
    assert await take.run_async(args={"itemName": "badge"}, tool_context=None) == {"message": "Taken."}
    assert json.loads(route.calls.last.request.content) == {"itemName": "badge"}


async def test_toolset_loads_the_spec_once(api, game):
    toolset = GameToolset(game)
    assert len(await toolset.get_tools()) == 7
    await toolset.get_tools()
    assert api.routes[0].call_count == 1


def test_agent_builds_without_network(game):
    agent = build_agent(game, model="any-model")
    assert agent.model == "any-model"
    assert agent.instruction == INSTRUCTION
