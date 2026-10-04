"""HTTP access to the game. The API key lives here, in tool code: the model never sees it."""

import asyncio
import re
from typing import Any, Awaitable, Callable

import httpx

COUNTED = {"examine", "move", "take", "drop", "use"}


class GameClient:
    """Calls the game API, retries on 429, and keeps the numbers you need to compare runs."""

    def __init__(
        self,
        url: str,
        key: str,
        http: httpx.AsyncClient | None = None,
        sleep: Callable[[float], Awaitable[Any]] = asyncio.sleep,
        max_retries: int = 3,
    ):
        self._http = http or httpx.AsyncClient(base_url=url.rstrip("/"), timeout=30)
        self._headers = {"Authorization": f"ApiKey {key}"}
        self._sleep = sleep
        self._max_retries = max_retries
        self.tool_calls = 0
        self.actions = 0
        self.score: int | None = None
        self.message: str | None = None

    @property
    def finished(self) -> bool:
        return self.score is not None

    async def spec(self) -> dict:
        """The OpenAPI description, public: no key needed."""
        res = await self._http.get("/openapi.json")
        res.raise_for_status()
        return res.json()

    async def call(self, method: str, path: str, body: dict | None = None) -> dict:
        """One game call. Game errors come back as data (`error`, `message`): they are hints for the model."""
        self.tool_calls += 1
        for attempt in range(self._max_retries + 1):
            res = await self._http.request(method, path, json=body, headers=self._headers)
            if res.status_code != 429 or attempt == self._max_retries:
                break
            # Retries and backoff belong in code: the model never sees the 429.
            await self._sleep(float(res.headers.get("Retry-After", 2 ** attempt)))
        data = res.json()
        if path.rsplit("/", 1)[-1] in COUNTED and res.status_code in (200, 400):
            self.actions += 1
        if res.status_code == 200 and "score" in data:
            self.score = data["score"]
            self.message = data.get("message")
            # The game's count is authoritative: it includes actions made before the agent started (a resumed run).
            match = re.search(r"in (\d+) actions", self.message or "")
            if match:
                self.actions = int(match.group(1))
        return data

    async def aclose(self) -> None:
        await self._http.aclose()
