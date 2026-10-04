// The tiny client from the "Step 2" guide, with a command line and 429 handling. Node 18+, no dependencies.
//
//   QUEST_URL=https://<instance> QUEST_KEY=qk_... node quest.mjs look
//   node quest.mjs move north
//   node quest.mjs use crystal console
//   node quest.mjs replay moves.txt        # one command per line, e.g. "take Access Badge"

/** One function per game operation. Errors come back as `{ error, message }`, never thrown. */
export function createClient({ url, key, fetch = globalThis.fetch, sleep = (ms) => new Promise((r) => setTimeout(r, ms)) }) {
  let calls = 0;

  async function call(command, body, retries = 2) {
    calls += 1;
    const res = await fetch(`${url.replace(/\/$/, '')}/game/${command}`, {
      method: body ? 'POST' : 'GET',
      headers: { Authorization: `ApiKey ${key}`, 'Content-Type': 'application/json' },
      body: body && JSON.stringify(body),
    });
    if (res.status === 429 && retries > 0) {
      await sleep(Number(res.headers.get('Retry-After') ?? 1) * 1000);
      return call(command, body, retries - 1);
    }
    return res.json();
  }

  return {
    look: () => call('look'),
    inventory: () => call('inventory'),
    examine: (target) => call('examine', { target }),
    move: (exit) => call('move', { exit }),
    take: (itemName) => call('take', { itemName }),
    drop: (itemName) => call('drop', { itemName }),
    use: (direct_object, indirect_object) => call('use', { direct_object, ...(indirect_object ? { indirect_object } : {}) }),
    get calls() {
      return calls;
    },
  };
}

/** Turns a command line ("take Access Badge", "use crystal console") into a client call. */
export function run(game, line) {
  const [command, ...words] = line.trim().split(/\s+/);
  const rest = words.join(' ');
  switch (command) {
    case 'look':
    case 'inventory':
      return game[command]();
    case 'examine':
    case 'move':
    case 'take':
    case 'drop':
      return game[command](rest);
    case 'use':
      // Two words: item then target. Use quotes-free aliases ("crystal", "console") for multi-word names.
      return game.use(words[0], words[1]);
    default:
      throw new Error(`Unknown command "${command}" (look, inventory, examine, move, take, drop, use)`);
  }
}

export function format(result) {
  if (result.error) return `✗ ${result.error}: ${result.message}`;
  if (result.name) {
    const items = result.items?.length ? `\nItems: ${result.items.join(', ')}` : '';
    return `${result.name}\n${result.description}${items}\nExits: ${result.exits.join(', ')}`;
  }
  return [result.message, result.description, result.inventory && `Carrying: ${result.inventory.join(', ') || 'nothing'}`, result.score != null && `Score: ${result.score}`]
    .filter(Boolean)
    .join('\n');
}

async function main(args) {
  const { QUEST_URL, QUEST_KEY } = process.env;
  if (!QUEST_URL || !QUEST_KEY) throw new Error('Set QUEST_URL and QUEST_KEY');
  const game = createClient({ url: QUEST_URL, key: QUEST_KEY });
  const lines = args[0] === 'replay'
    ? (await import('node:fs')).readFileSync(args[1], 'utf8').split('\n').filter((l) => l.trim() && !l.startsWith('#'))
    : [args.join(' ') || 'look'];
  for (const line of lines) {
    if (lines.length > 1) console.log(`> ${line}`);
    console.log(format(await run(game, line)));
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main(process.argv.slice(2)).catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}
