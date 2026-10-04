/**
 * Uploads level JSON files through the admin API, e.g. from your private levels folder:
 *
 *   QUEST_URL=https://quest.example.com QUEST_API_KEY=qk_... npm run levels:push -- ../quest-levels/*.json --publish
 *
 * The API key must belong to an admin. Files are validated locally first, then by the server.
 */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { LevelValidationError, parseLevel } from '@quest/engine';

const { values, positionals: files } = parseArgs({
  allowPositionals: true,
  options: { publish: { type: 'boolean', default: false }, 'dry-run': { type: 'boolean', default: false } },
});
const url = (process.env.QUEST_URL ?? 'http://localhost:8080').replace(/\/$/, '');
const key = process.env.QUEST_API_KEY;
if (!files.length) fail('Usage: levels:push <level.json>... [--publish] [--dry-run]');
if (!key && !values['dry-run']) fail('Set QUEST_API_KEY to an admin API key');

// npm runs workspace scripts from apps/api; resolve paths from where the command was typed.
let failed = false;
for (const file of files) {
  try {
    const level = parseLevel(JSON.parse(await readFile(resolve(process.env.INIT_CWD ?? '.', file), 'utf8')));
    if (values['dry-run']) {
      console.log(`ok    ${file} (${level.id}, valid)`);
      continue;
    }
    const headers = { Authorization: `ApiKey ${key}`, 'Content-Type': 'application/json' };
    const put = await fetch(`${url}/api/admin/levels/${level.id}`, { method: 'PUT', headers, body: JSON.stringify(level) });
    if (!put.ok) throw new Error(`${put.status} ${await put.text()}`);
    if (values.publish) {
      const patch = await fetch(`${url}/api/admin/levels/${level.id}`, { method: 'PATCH', headers, body: '{"published":true}' });
      if (!patch.ok) throw new Error(`publish: ${patch.status} ${await patch.text()}`);
    }
    console.log(`ok    ${file} → ${level.id}${put.status === 201 ? ' (new)' : ''}${values.publish ? ', published' : ''}`);
  } catch (e) {
    failed = true;
    console.error(`FAIL  ${file}\n${e instanceof LevelValidationError ? e.message : String(e)}`);
  }
}
process.exit(failed ? 1 : 0);

function fail(message: string): never {
  console.error(message);
  process.exit(2);
}
