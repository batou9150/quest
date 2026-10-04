import json
from pathlib import Path

import httpx
import pytest
import respx

from quest_agent.game import GameClient

URL = "https://quest.test"
KEY = "qk_test_secret"
# The repo's real spec: the tests fail if the tools drift from the API.
SPEC = json.loads((Path(__file__).parents[3] / "apps" / "api" / "openapi.json").read_text())


@pytest.fixture
def api():
    with respx.mock(base_url=URL, assert_all_called=False) as mock:
        mock.get("/openapi.json").respond(json=SPEC)
        yield mock


@pytest.fixture
def sleeps():
    return []


@pytest.fixture
def anyio_backend():
    return "asyncio"


@pytest.fixture
def game(api, sleeps):
    async def fake_sleep(seconds):
        sleeps.append(seconds)

    return GameClient(URL, KEY, http=httpx.AsyncClient(base_url=URL), sleep=fake_sleep)
