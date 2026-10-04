# The Quantum Quest

A text adventure you play over HTTP: in the browser, with `curl`, or with your own AI agent.

```bash
curl -H "Authorization: ApiKey $QUEST_KEY" https://<your-instance>/game/look
```

Sign in, start a level from **Level Select**, get an API key from **API Access**, then explore with `look`, `move`, `take`, `use`… The game API is described in [`apps/api/openapi.json`](apps/api/openapi.json) (also served at `/openapi.json`).

## Run it locally

Requires Node 24+.

```bash
npm install
cp apps/api/.env.example apps/api/.env   # in-memory store, dev login, no Google Cloud needed
npm run dev                              # API on :8080, web app on http://localhost:5173
```

Log in with any name on the login page (dev login). Logging in as "Admin" (`admin@dev.local`) gives the admin role.

To use a real Firestore locally, start the emulator (needs Java 21+) and set `STORE=firestore` in `.env`:

```bash
gcloud emulators firestore start --host-port=localhost:8681
# .env: STORE=firestore  FIRESTORE_EMULATOR_HOST=localhost:8681  GOOGLE_CLOUD_PROJECT=demo-quest  SEED_DEMO=true
```

## Commands

| | |
|---|---|
| `npm test` | Engine, demo level and API tests (add `FIRESTORE_EMULATOR_HOST=…` to also test the Firestore store) |
| `npm run typecheck` | TypeScript across all packages |
| `npm run build` | Web app to `apps/web/dist`, API bundle to `apps/api/dist` |
| `npm run levels:push -- <files> [--publish] [--dry-run]` | Validate and upload levels (see [docs/LEVELS.md](docs/LEVELS.md)) |
| `docker build -t quest .` | Production image |

## Docs

- [Architecture](docs/ARCHITECTURE.md): components, decisions, data model, security
- [Deploying to Google Cloud](docs/DEPLOY.md): Cloud Run, Firestore, OAuth apps, GitHub Actions
- [Writing levels](docs/LEVELS.md)

## Licence

[MIT](LICENSE)
