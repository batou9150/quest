---
order: 1
title: What is a text adventure?
category: Getting started
summary: The genre in two minutes, and how The Quantum Quest turns it into a programming game.
imageUrl: https://raw.githubusercontent.com/batou9150/quest/main/content/guides/images/what-is-a-text-adventure.jpg
---

A **text adventure** (also called *interactive fiction*) is a game where everything happens through text. The game describes where you are; you answer with short commands such as `look`, `take key` or `go north`. There are no graphics: the world lives in the descriptions, and in your head.

The genre dates back to the 1970s, with games like *Colossal Cave Adventure* and *Zork*. Their puzzles are about noticing details, carrying the right item to the right place, and combining things in clever ways.

## How The Quantum Quest plays

Each **level** is a small world: a handful of rooms, items to find and puzzles to solve. You win a level by finding the way out.

| Command | What it does |
|---|---|
| `look` | Describe the room you are in: its items and exits |
| `inventory` | List what you carry |
| `examine <thing>` | Look closely at an item or an exit |
| `move <exit>` | Go through an exit, e.g. `move north` (or just `n`) |
| `take <item>` / `drop <item>` | Pick up or put down an item |
| `use <item> [on <thing>]` | Use an item, alone or on something else |

## The twist: it is an API

Every command is also an HTTP endpoint. You can play in the browser terminal (**Play** in the menu), but also with `curl`, a script you write, or an AI agent you build. See [Playing with the API](/guides/playing-with-the-api).

## Scoring

Each level is worth a number of points if you finish it within its *par*: a number of actions. Every action beyond par costs a few points. `look` and `inventory` are free, so look around as much as you like; it is wandering and guessing that cost you.

## Tips

- Read every description. The answer is usually written somewhere.
- `examine` everything that looks unusual, including exits.
- If something does not work, the game usually tells you why.
- Locked? Look for something that unlocks it in another room.
