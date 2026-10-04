# Architecture

The Quantum Quest is a text adventure played over HTTP, by people in a browser and by scripts or AI agents with an API key.

```
 Browser ──────────┐                       ┌────────────────────────────────────┐
  (session cookie) │   HTTPS               │ Cloud Run service "quest"          │
                   ├──────────────────────►│ europe-west1, min 0 / max 3        │
 Scripts, agents ──┘                       │                                    │
  (ApiKey header)                          │  /            React app (static)   │
                                           │  /auth/*      OAuth, sessions      │
 Google / GitHub ◄── OAuth redirects ──────│  /api/*       site API             │
                                           │  /api/admin/* admin API            │
                                           │  /game/*      game API (OpenAPI)   │
                                           │  engine       pure game logic      │
                                           └──────────────┬─────────────────────┘
                                                          │ service account, transactions
                                                          ▼
                                           ┌────────────────────────────────────┐
                                           │ Firestore (Native), europe-west1   │
                                           └────────────────────────────────────┘
```

No Firebase products: the browser never talks to Firestore, only to the API.

## Decisions

| Topic | Decision | Why |
|---|---|---|
| Hosting | One Cloud Run service serves the React build and the API | One deployable, same origin (no CORS), cookies just work |
| Cold starts | `min-instances=0` | Costs nothing when idle; first request after idle takes ~1–2 s |
| Region | `europe-west1` for Cloud Run and Firestore | Firestore's location cannot be changed later |
| Language | TypeScript everywhere, npm workspaces | Types shared between engine, API and web |
| Login | Own OAuth (Google, GitHub) with [arctic](https://arcticjs.dev), sessions in Firestore | No Firebase dependency; ~150 lines |
| Game API auth | `Authorization: ApiKey <key>`; only the SHA-256 of the key is stored | A leaked database does not leak keys |
| Active level | Each user has one `activeLevelId`; `/game/*` acts on it | Keeps the game API simple for agents; matches "start from Level Select" |
| Leaderboards | Plain API calls, polled every 15 s by the page | No websockets, no browser access to Firestore |
| Level content | Only the three demo levels are in this repo; real levels are uploaded through the admin API | The repo is public; level files are the answer key |
| Admin | `/api/admin/*` + admin pages, for users with `role: "admin"` | Roles, bans, levels, events, guides |
| Starter content | The demo levels and `content/guides/*.md` are added at startup when missing | A fresh install is playable and documented; admins can edit them afterwards |
| Languages | Website, guides and game texts in English and French. A level carries its translations in `locales`, laid over the English texts; `/game/*` and `/api/levels` take `?lang=` or `Accept-Language`. Commands, exit names, error codes and API error messages stay in English | Commands and exit names are the API that bots and agents call: one vocabulary for everyone. A translation that is missing falls back to English, and a run can change language at any time since the game state only holds ids |

## Code layout

```
packages/engine        Pure game engine: level schema (zod) + step(level, state, command). No I/O.
packages/levels-demo   The three public demo levels (levels/*.json) and their playthrough tests.
packages/shared        Types and zod schemas of the site API, shared by api and web.
content/guides         Starter guides (markdown with front matter): <slug>.md in English, <slug>.fr.md in French. Seeded at startup.
apps/api               Hono server: routes, auth, Firestore/memory storage, OpenAPI file.
apps/web               React + Vite + Tailwind front end, including admin pages.
```

The engine is deterministic and side-effect free, so the whole game logic is unit-tested without a server or database. Levels are data (rooms, items, exits, rules); see [LEVELS.md](LEVELS.md).

## Request flows

**Login.** `/auth/google` → Google → `/auth/google/callback` checks the OAuth `state` cookie (and PKCE for Google), finds or creates the user through `identities/{provider}:{id}`, stores `sessions/{sha256(token)}` and sets an `HttpOnly; Secure; SameSite=Lax` cookie for 30 days. Emails listed in `ADMIN_EMAILS` get the admin role at login, which bootstraps the first admin.

**Game action.** `POST /game/move` → API key or cookie → user → rate limit → one Firestore transaction: read the user, their progress on the active level and (if the move finishes the level) their scores in running events; run `step()`; write the new state. Completion also updates the best score, the user's total, and event leaderboards, atomically. Concurrent calls from the same agent therefore cannot corrupt a run.

**Level unlock.** Published levels are ordered by `number`. The first is open; each next one opens when the previous has been completed. Admins can start any level to test it.

**Scoring.** A level is worth `points` when finished within `par` counted actions (examine, move, take, drop, use; look and inventory are free). Each extra action costs `penaltyPerAction`, down to a floor of 20% of `points`. A user's total is the sum of their best score per level. An event's leaderboard sums each player's best score per eligible level, for runs completed while the event is running.

## Data model (Firestore)

| Path | Content |
|---|---|
| `users/{uid}` | profile, `role` (player/admin), `banned`, `apiKeyHash`, `activeLevelId`, `totalScore` |
| `users/{uid}/progress/{levelId}` | current run `state`, `bestScore`, `completions` |
| `identities/{provider}:{providerId}` | `uid` (login lookup) |
| `sessions/{sha256(token)}` | `uid`, `expiresAt` |
| `apiKeys/{sha256(key)}` | `uid` |
| `levels/{levelId}` | full level definition, `published` |
| `events/{eventId}` | title, descriptions, `startTime`, `endTime`, `levelIds` (empty = all) |
| `events/{eventId}/scores/{uid}` | `displayName`, `score`, best score per level |
| `guides/{slug}` | `locales.en` and optional `locales.fr` (title, category, summary, markdown content), shared `imageUrl`, `published` |

All queries use single-field indexes, which Firestore creates automatically; no composite index is needed. Dates are ISO-8601 strings.

Recommended: set a TTL policy on `sessions.expiresAt` so expired sessions are deleted automatically (see [DEPLOY.md](DEPLOY.md)).

## Security

- **Secrets**: only the two OAuth client secrets, in Secret Manager. Deploys use Workload Identity Federation, so no service-account key exists.
- **Least privilege**: the runtime service account only has `roles/datastore.user` and access to the two secrets.
- **CSRF**: cookies are `SameSite=Lax`, and the API rejects cross-origin form submissions (Origin check). JSON bodies cannot be sent cross-site without CORS, which is not enabled.
- **Headers**: Content-Security-Policy (`default-src 'self'`), `frame-ancestors 'none'`, and the other `secure-headers` defaults.
- **Abuse and cost**: 60 game calls per user per minute (per instance), 512 KB body limit, `max-instances=3`, and a billing budget alert. Each counted game action is one Firestore transaction: 2 reads and 1 write, plus a query for unfinished events on moves.
- **Admin**: every `/api/admin/*` route checks `role === "admin"`. An admin cannot demote or ban themselves. An admin's API key has admin rights (used by `npm run levels:push`): keep it private.
- **Dev login** (`POST /auth/dev`) exists only when `DEV_LOGIN=true`, and the server refuses to start with it in production.

## Known limits and next steps

- The rate limiter is per instance. With several instances, the effective limit is multiplied; move it to Firestore or add Cloud Armor if abuse appears.
- Renaming yourself does not update your name on past event leaderboards until your next completed level in that event.
- Deleting a level leaves players' progress documents in place (harmless, invisible).
- Admin statistics (players per level, where players get stuck) are not built yet; the `game_action` log lines contain the data and can be exported to BigQuery.
