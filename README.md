# RPA Local (UIPath-style) Reliability Build

Single-user local RPA with node-graph orchestration, resilient execution, web + desktop automation, recorder support, local LLM cleanup, run diagnostics, and workflow version lifecycle. Runs entirely on your machine with Docker.

## Services
- **web**: React node-graph UI (n8n-style) with runs timeline and diff
- **server**: API + workflow runner + web recorder
- **agent**: Desktop automation agent (record + run)
- **db**: Postgres
- **redis**: Job queue
- **ollama**: Local LLM

## Quick start
1. Copy env and set credentials
   - `cp .env.example .env`
2. Start everything
   - `docker compose up --build`
3. Open UI
   - `http://localhost:5173`

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

## Local LLM
- Ollama runs on `http://ollama:11434` inside Docker. You can pull a model in the ollama container:
  - `docker exec -it rpa-ollama ollama pull llama3.2`

## API
- `POST /api/auth/login`
- `GET /api/workflows`
- `POST /api/workflows`
- `PUT /api/workflows/:id` (save draft)
- `POST /api/workflows/:id/publish`
- `GET /api/workflows/:id/versions`
- `POST /api/workflows/:id/rollback`
- `POST /api/runs/start`
- `GET /api/workflows/:id/runs`
- `GET /api/runs/:id`
- `POST /api/runs/:id/approve`
- `GET /api/runs/:id/diff-last-success`
- `GET /api/secrets`
- `POST /api/secrets`
- `POST /api/recorders/web/start`
- `POST /api/recorders/desktop/start`
- `POST /api/recorders/desktop/stop`

## Auth and secrets env
- `APP_USERNAME` and one of:
- `APP_PASSWORD` (plain local dev)
- `APP_PASSWORD_HASH_ARGON2` (preferred)
- `SECRET_ENCRYPTION_KEY` for local secret encryption

## Tests
- Server tests:
- `docker compose run --rm server npm test`
