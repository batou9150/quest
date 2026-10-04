# Tiny client (Node.js)

The reference answer to *Step 2: An LLM writes your client*. Node 18+, no dependencies.

```bash
export QUEST_URL=https://<your-instance> QUEST_KEY=qk_...
node quest.mjs look
node quest.mjs examine tablet
node quest.mjs use crystal console       # use <item> <target>: one word each, aliases work
node quest.mjs replay moves.txt          # one command per line, lines starting with # are skipped
```

What to point out when you show it:

- **One function per operation**, named and shaped like the spec (`itemName`, `direct_object`…).
- **Errors are data.** A failed action returns `{ error, message }` instead of throwing: the message is a hint.
- **Backoff.** On `429` it waits for `Retry-After` seconds and retries, at most twice.
- **The key comes from the environment**, never from the code.

`createClient({ url, key })` is exported, so the functions can be wrapped as agent tools in step 3.

Tests: `node --test examples/client-node/*.test.mjs` (a fake `fetch`, no server).
