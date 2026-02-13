# ForgeFlow

ForgeFlow is a local-first automation platform for web and desktop workflows.

It combines a visual node graph, reliable workflow execution, scheduling, approvals, local LLM transforms, and operational tooling in a single Docker-based stack.

## What You Get
- Visual workflow builder (React Flow)
- Web automation (Playwright) and desktop automation (agent service)
- Draft/publish workflow lifecycle with versions and rollback
- Retry/timeout/checkpoint execution engine
- Manual approvals and resume-from-failure
- Templates, schedules, schedule presets, upcoming-run calendar
- Integrations (`http_api`, `postgresql`, `mysql`, `mongodb`, `google_sheets`, `airtable`, `s3`)
- Secrets management (encrypted), webhook delivery, audit logging
- Metrics dashboard + Prometheus `/metrics`
- Local auth with optional TOTP 2FA

## Services
- `web`: `http://localhost:5173`
- `server`: `http://localhost:8080`
- `agent`: `http://localhost:7001`
- `db`: PostgreSQL
- `redis`: runtime dependency
- `ollama`: local LLM runtime

## Quick Start
1. Start everything:
```bash
./start.sh
```
2. Open `http://localhost:5173`
3. Sign in with `.env` credentials (default: `local` / `localpass`)
4. Optional shortcuts: `Ctrl+S` save, `Ctrl+T` test run, `Ctrl+R` run, `Ctrl+D` duplicate selected node

`start.sh` will:
- create `.env` from `.env.example` if missing
- attempt X11 auth (`xhost +local:`) unless `AUTO_X11_AUTH=0`
- run DB migration
- bring up Docker Compose stack
- auto-update images/builds unless `AUTO_UPDATE=0`

For a full operator walkthrough, see `QUICKSTART.md`.

## Documentation
- `docs/README.md`
- `docs/ARCHITECTURE.md`
- `docs/API_REFERENCE.md`
- `docs/DEPLOYMENT.md`
- `docs/CONTRIBUTING.md`

## Key Configuration
Main `.env` variables:
- `APP_USERNAME`, `APP_PASSWORD`
- `JWT_SECRET`
- `SECRET_ENCRYPTION_KEY`
- `DATABASE_URL`, `REDIS_URL`
- `OLLAMA_BASE_URL`, `AGENT_BASE_URL`
- `DISPLAY`, `PLAYWRIGHT_HEADLESS`
- `RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_MAX`, `RATE_LIMIT_LOGIN_MAX`
- `LOG_LEVEL`, `REQUEST_LOGS`
- `AUTHZ_FILE`, `WEBHOOKS_FILE`, `SCHEDULES_FILE`, `AUDIT_FILE`
- `SELECTOR_AI_ENABLED`, `SELECTOR_AI_MODEL`

## Common Commands
Start:
```bash
./start.sh
```

Start without auto-update:
```bash
AUTO_UPDATE=0 ./start.sh
```

Run migrations manually:
```bash
docker compose run --rm server npm run prisma:migrate
```

Run backend tests:
```bash
docker compose run --rm server npm test
```

Stop stack:
```bash
docker compose down
```

Logs:
```bash
docker compose logs -f
```

## API Areas
- Auth: `/api/auth/*`
- Workflows: `/api/workflows*`
- Runs: `/api/runs*`
- Templates: `/api/templates`, `/api/workflows/from-template`
- Schedules: `/api/schedules*`
- Metrics dashboard: `/api/metrics/dashboard`
- Prometheus metrics: `/metrics`
- Integrations: `/api/integrations*`
- Secrets: `/api/secrets*`
- Webhooks: `/api/webhooks*`
- Admin: `/api/admin/*`

## Troubleshooting
Module not found in containers:
```bash
docker compose up --build --renew-anon-volumes
```

Desktop automation issues on Linux:
```bash
xhost +local:
```
Check `.env` `DISPLAY` (usually `:0`).

Ollama model missing:
```bash
docker exec -it rpa-ollama ollama pull llama3.2
```

Port `11434` already in use:
- stop conflicting host service, or
- change Ollama port mapping in `docker-compose.yml`.

## Support
- https://buymeacoffee.com/mackeh
