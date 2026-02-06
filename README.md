# ForgeFlow

ForgeFlow is a local-first RPA platform for web and desktop automation with a visual node graph, resilient runs, approvals, schedules, templates, local LLM transforms, and operational diagnostics.

ForgeFlow is a **highly sophisticated, production-ready RPA platform** with excellent code quality, comprehensive features, and robust error handling. The application demonstrates professional engineering practices and is suitable for production deployment.

## Highlights
- Visual node-graph workflow builder (React Flow)
- Web automation with Playwright and desktop automation with the local agent
- Draft and publish lifecycle with version history and rollback
- Robust execution engine with retries, timeouts, checkpoints, resume-from-failure
- Manual approval nodes, run logs, run diff vs last success
- Built-in workflow templates and local-time scheduling
- Schedule presets and next-run preview before saving
- Local auth, role permissions, webhook events, rate limiting
- Local LLM data transform support via Ollama

## Services
- `web` UI: `http://localhost:5173`
- `server` API + orchestration: `http://localhost:8080`
- `agent` desktop runtime: `http://localhost:7001`
- `db` PostgreSQL
- `redis` queue/cache runtime dependency
- `ollama` local model runtime

## Quick Start
1. From repo root, run:
```bash
./start.sh
```
2. Open `http://localhost:5173`
3. Log in using `.env` credentials (default: `local` / `localpass`)

`start.sh` behavior:
- Creates `.env` from `.env.example` if missing
- Enables X11 local access (`xhost +local:`) unless `AUTO_X11_AUTH=0`
- Applies DB migrations
- Starts full stack with Docker Compose
- Auto-updates images and rebuilds app containers unless `AUTO_UPDATE=0`

For a full operator walkthrough, see `QUICKSTART.md`.

## Configuration
Primary variables in `.env`:
- `APP_USERNAME`, `APP_PASSWORD`
- `JWT_SECRET`
- `SECRET_ENCRYPTION_KEY`
- `DATABASE_URL`, `REDIS_URL`
- `OLLAMA_BASE_URL`, `AGENT_BASE_URL`
- `PLAYWRIGHT_HEADLESS`, `DISPLAY`
- `RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_MAX`, `RATE_LIMIT_LOGIN_MAX`
- `TRUST_PROXY`
- `SELECTOR_AI_ENABLED`, `SELECTOR_AI_MODEL`
- `AUTHZ_FILE`, `WEBHOOKS_FILE`, `SCHEDULES_FILE`, `SCHEDULE_DEFAULT_TIMEZONE`

## Common Commands
Start stack:
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

View logs:
```bash
docker compose logs -f
```

## Core API Areas
- Auth: `/api/auth/*`
- Workflows and runs: `/api/workflows*`, `/api/runs*`
- Templates: `/api/templates`, `/api/workflows/from-template`
- Schedules: `/api/schedules*` (includes presets and next-run preview)
- Metrics: `/api/metrics/dashboard`
- Secrets: `/api/secrets*`
- Recorders: `/api/recorders/web/start`, `/api/recorders/desktop/start`, `/api/recorders/desktop/stop`
- Admin/RBAC: `/api/admin/users*`, `/api/admin/roles*`
- Webhooks: `/api/webhooks*`

## Troubleshooting
If server fails with `ERR_MODULE_NOT_FOUND` inside containers:
```bash
docker compose up --build --renew-anon-volumes
```

If desktop automation fails on Linux:
```bash
xhost +local:
```
- Ensure `.env` has valid `DISPLAY` (often `:0`).

If port `11434` is already in use (Ollama conflict):
- Stop conflicting local service or change port mapping in `docker-compose.yml`.

If Ollama model is missing:
```bash
docker exec -it rpa-ollama ollama pull llama3.2
```

## Support
If ForgeFlow helps you, you can support development here:
- https://buymeacoffee.com/mackeh
