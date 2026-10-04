"""python -m quest_agent: plays your active level once and prints the numbers to compare runs."""

import argparse
import asyncio
import json
import os

from google.adk.runners import InMemoryRunner
from google.genai import types

from .agent import build_agent, game_from_env


async def play(runner: InMemoryRunner, log=print) -> None:
    """Runs the agent once and prints each tool call and result. The agent stops itself (see build_agent)."""
    session = await runner.session_service.create_session(app_name=runner.app_name, user_id="player")
    goal = types.Content(role="user", parts=[types.Part(text="Play the level.")])
    async for event in runner.run_async(user_id="player", session_id=session.id, new_message=goal):
        for call in event.get_function_calls():
            log(f"→ {call.name}({json.dumps(call.args or {})})")
        for response in event.get_function_responses():
            log(f"  {json.dumps(response.response)}")
        if event.is_final_response() and event.content and event.content.parts:
            log("".join(part.text or "" for part in event.content.parts).strip())


async def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--max-steps", type=int, default=50, help="stop after this many tool calls")
    parser.add_argument("--model", default=os.environ.get("QUEST_MODEL"), help="model name (default: QUEST_MODEL or the ADK default)")
    args = parser.parse_args()

    game = game_from_env()
    await game.spec()  # fail early with a clear error if the site is unreachable
    agent = build_agent(game, args.model, args.max_steps)
    runner = InMemoryRunner(agent=agent, app_name="quest_agent")
    try:
        await play(runner)
    finally:
        await game.aclose()

    print()
    print(f"model:           {agent.model}")
    print(f"score:           {game.score if game.finished else 'level not finished'}")
    print(f"counted actions: {game.actions}")
    print(f"tool calls:      {game.tool_calls}")


if __name__ == "__main__":
    asyncio.run(main())
