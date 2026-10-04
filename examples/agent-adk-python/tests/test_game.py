import httpx
import pytest

from conftest import KEY

pytestmark = pytest.mark.anyio


async def test_sends_the_key_in_the_header(api, game):
    route = api.get("/game/look").respond(json={"name": "Briefing Room"})
    await game.call("GET", "/game/look")
    assert route.calls.last.request.headers["Authorization"] == f"ApiKey {KEY}"


async def test_returns_game_errors_as_data(api, game):
    error = {"error": "locked", "message": "You need an access badge."}
    api.post("/game/move").respond(400, json=error)
    assert await game.call("POST", "/game/move", {"exit": "north"}) == error
    assert game.actions == 1  # a failed action still counts


async def test_waits_for_retry_after_on_429(api, game, sleeps):
    api.get("/game/inventory").mock(
        side_effect=[
            httpx.Response(429, json={"error": "rate_limited"}, headers={"Retry-After": "7"}),
            httpx.Response(200, json={"inventory": []}),
        ]
    )
    assert await game.call("GET", "/game/inventory") == {"inventory": []}
    assert sleeps == [7.0]
    assert game.tool_calls == 1


async def test_gives_up_after_max_retries(api, game, sleeps):
    api.get("/game/look").respond(429, json={"error": "rate_limited", "message": "Too many requests"})
    assert (await game.call("GET", "/game/look"))["error"] == "rate_limited"
    assert len(sleeps) == 3


async def test_counts_actions_but_not_free_commands(api, game):
    api.get("/game/look").respond(json={"name": "Room"})
    api.post("/game/examine").respond(json={"description": "A tablet."})
    await game.call("GET", "/game/look")
    await game.call("POST", "/game/examine", {"target": "tablet"})
    assert (game.tool_calls, game.actions) == (2, 1)


async def test_records_the_score_and_the_games_action_count(api, game):
    api.post("/game/move").respond(json={"message": "You step through. Level complete in 16 actions.", "score": 96})
    await game.call("POST", "/game/move", {"exit": "ring"})
    assert game.finished
    assert (game.score, game.actions) == (96, 16)
