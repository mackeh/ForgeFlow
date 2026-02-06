# ForgeFlow RPA Reliability Build

Single-user local RPA with node-graph orchestration, resilient execution, web + desktop automation, recorder support, local LLM cleanup, run diagnostics, and workflow version lifecycle. Runs entirely on your machine with Docker.

ForgeFlow is a **highly sophisticated, production-ready RPA platform** with excellent code quality, comprehensive features, and robust error handling. The application demonstrates professional engineering practices and is suitable for production deployment.

## Services
- **web**: React graph-node UI with runs timeline and diff
- **server**: API + workflow runner + web recorder
- **agent**: Desktop automation agent (record + run)
- **db**: Postgres
- **redis**: Job queue
- **ollama**: Local LLM

## Quick start
1. Copy env and set credentials
   - `cp .env.example .env`
2. Start everything
   - `docker compose up --build --renew-anon-volumes`
3. Open UI
   - `http://localhost:5173`

Detailed usage guide:
- `QUICKSTART.md`

### Auto-update on start
- `./start.sh` now auto-updates dependencies and images by default:
- Pulls latest image tags.
- Rebuilds `server`, `web`, and `agent` with fresh base layers and dependency installs.
- Disable with:
- `AUTO_UPDATE=0 ./start.sh`
- `start.sh` also attempts `xhost +local:` automatically for desktop automation.
- Disable X11 auth automation with:
- `AUTO_X11_AUTH=0 ./start.sh`
## First-time DB setup
- `docker compose run --rm server npm run prisma:migrate`

## Notes / OS requirements
- **Web automation** uses Playwright in the server container.
- **Desktop automation + recording** requires access to a display. On Linux you can run:
  - `xhost +local:`
  - Then set `DISPLAY` in `.env` to your host display (usually `:0`).
- On macOS/Windows, you’ll need to run the agent outside Docker or provide a remote desktop environment. The agent container includes Xvfb for headless workflows.
- **Desktop recorder** captures a small image around each click and stores it under `apps/agent/recordings`.
- Thumbnails in the UI are served from the server at `/recordings/...` (mounted from the agent recordings folder).
- Failure artifacts (screenshots + DOM snapshots) are stored under `apps/server/artifacts` and served at `/artifacts/...`.
- Desktop preflight checks `/preflight` on the agent and blocks runs when X11 authorization is not valid.

## Reliability features
- Node state machine: `queued -> running -> succeeded/failed/skipped`.
- Retries with exponential backoff, per-node timeout, and global run timeout.
- Checkpoint persistence with resume support from failed runs.
- Branch/join semantics (nodes run when all predecessors reach terminal state).
- Manual approval node support with `WAITING_APPROVAL` run state.
- Selector strategy support for web nodes (`testId`, `aria`, role/name, css, xpath) with suggestion hints.
- Validation nodes (`validate_record`, `submit_guard`) and schema-enforced LLM transforms.
- Deterministic LLM fallback transform when JSON/schema output fails.
- Encrypted local secret storage and `{{secret:KEY}}` interpolation.
- Draft/publish workflow lifecycle with version history and rollback.
- Run timeline and diff against last successful run.
- UI toast feedback for key actions (save/publish/run/record/approve/error states).
- Node auto-placement for new nodes, plus `Auto Layout` and `Snap: On/Off` controls in the toolbar.
- Local multi-user auth store with RBAC permissions (`admin`, `operator`, `viewer`, and custom roles).
- Webhook integrations for run lifecycle events (`run.started`, `run.succeeded`, `run.failed`, `run.waiting_approval`).
- Scheduled executions run in local timezone by default and include schedule metadata in run input.

## UI improvements
- Toast notifications provide immediate success/error/info feedback.
- `Auto Layout` reorganizes nodes into a readable grid.
- `Snap: On/Off` toggles grid snapping for manual node positioning.
- Inspector includes `Quick Edit` fields for common node settings, with raw JSON still available for advanced edits.

## Local LLM
- Ollama runs on `http://ollama:11434` inside Docker (not exposed on host by default to avoid port conflicts). You can pull a model in the ollama container:
  - `docker exec -it rpa-ollama ollama pull llama3.2`

## API
- `POST /api/auth/login`
- `GET /api/auth/me`
- `GET /api/workflows`
- `POST /api/workflows`
- `PUT /api/workflows/:id` (save draft)
- `POST /api/workflows/:id/publish`
- `GET /api/workflows/:id/versions`
- `POST /api/workflows/:id/rollback`
- `POST /api/runs/start`
- `POST /api/system/preflight`
- `GET /api/workflows/:id/runs`
- `GET /api/runs/:id`
- `POST /api/runs/:id/approve`
- `GET /api/runs/:id/diff-last-success`
- `GET /api/secrets`
- `POST /api/secrets`
- `POST /api/recorders/web/start`
- `POST /api/recorders/desktop/start`
- `POST /api/recorders/desktop/stop`
- `GET /api/templates`
- `POST /api/workflows/from-template`
- `GET /api/system/time`
- `GET /api/schedules`
- `POST /api/schedules`
- `PUT /api/schedules/:id`
- `DELETE /api/schedules/:id`
- `POST /api/schedules/:id/run-now`
- `GET /api/metrics/dashboard`
- `GET /api/admin/users`
- `POST /api/admin/users`
- `PUT /api/admin/users/:username`
- `DELETE /api/admin/users/:username`
- `GET /api/admin/roles`
- `PUT /api/admin/roles/:role`
- `GET /api/webhooks/events`
- `GET /api/webhooks`
- `POST /api/webhooks`
- `PUT /api/webhooks/:id`
- `DELETE /api/webhooks/:id`
- `POST /api/webhooks/:id/test`

## Auth and secrets env
- `APP_USERNAME` and one of:
- `APP_PASSWORD` (plain local dev)
- `APP_PASSWORD_HASH_ARGON2` (preferred)
- `SECRET_ENCRYPTION_KEY` for local secret encryption
- `PLAYWRIGHT_HEADLESS=true` (recommended default for Docker)
- `RATE_LIMIT_WINDOW_MS` API rate-limit window in ms (default `900000`)
- `RATE_LIMIT_MAX` max API requests per window (default `300`)
- `RATE_LIMIT_LOGIN_MAX` max login attempts per window (default `25`)
- `TRUST_PROXY=true` if running behind reverse proxy
- `AUTHZ_FILE=./data/authz.json` path for local users/roles store
- `WEBHOOKS_FILE=./data/webhooks.json` path for webhook configuration store

## Tests
- Server tests:
- `docker compose run --rm server npm test`
