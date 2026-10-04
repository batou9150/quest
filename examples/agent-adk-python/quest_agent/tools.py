"""Turns the game's OpenAPI description into ADK tools: one tool per operation.

ADK's OpenAPIToolset does the same in one line. This module does it by hand so the mapping
is visible: operationId -> tool name, summary + description -> tool description,
request body schema -> tool parameters.
"""

from typing import Any

from google.adk.tools import BaseTool, ToolContext
from google.adk.tools.base_toolset import BaseToolset
from google.genai import types

from .game import GameClient


def resolve(schema: Any, spec: dict) -> Any:
    """Inlines `$ref`s so the model gets a self-contained JSON schema."""
    if isinstance(schema, dict):
        if "$ref" in schema:
            name = schema["$ref"].rsplit("/", 1)[-1]
            return resolve(spec["components"]["schemas"][name], spec)
        return {k: resolve(v, spec) for k, v in schema.items() if k != "title"}
    if isinstance(schema, list):
        return [resolve(v, spec) for v in schema]
    return schema


class GameTool(BaseTool):
    """One game operation, called through the shared GameClient."""

    def __init__(self, game: GameClient, method: str, path: str, operation: dict, spec: dict):
        description = "\n\n".join(filter(None, [operation.get("summary"), operation.get("description")]))
        super().__init__(name=operation["operationId"], description=description)
        self._game = game
        self.method = method.upper()
        self.path = path
        body = operation.get("requestBody", {}).get("content", {}).get("application/json", {}).get("schema")
        self.parameters = resolve(body, spec) if body else None

    def _get_declaration(self) -> types.FunctionDeclaration:
        return types.FunctionDeclaration(
            name=self.name, description=self.description, parameters_json_schema=self.parameters
        )

    async def run_async(self, *, args: dict[str, Any], tool_context: ToolContext) -> dict:
        return await self._game.call(self.method, self.path, args if self.parameters else None)


def tools_from_spec(spec: dict, game: GameClient) -> list[GameTool]:
    """The game operations (paths under /game/) of an OpenAPI description, as tools."""
    return [
        GameTool(game, method, path, operation, spec)
        for path, operations in spec["paths"].items()
        if path.startswith("/game/")
        for method, operation in operations.items()
    ]


class GameToolset(BaseToolset):
    """Loads /openapi.json on first use, so the agent can be built without network access."""

    def __init__(self, game: GameClient):
        super().__init__()
        self._game = game
        self._tools: list[GameTool] | None = None

    async def get_tools(self, readonly_context=None) -> list[BaseTool]:
        if self._tools is None:
            self._tools = tools_from_spec(await self._game.spec(), self._game)
        return list(self._tools)
