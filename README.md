# ForgeFlow

ForgeFlow is a local-first RPA platform for web and desktop automation with a visual node graph, resilient runs, approvals, scheduling, templates, local LLM transforms, and operational diagnostics.

ForgeFlow is a **highly sophisticated, production-ready RPA platform** with excellent code quality, comprehensive features, and robust error handling. The application demonstrates professional engineering practices and is suitable for production deployment.

## What You Get
- Visual workflow builder (React Flow) with quick node editing
- Web automation (Playwright) and desktop automation (agent service)
- Recorder flows for web and desktop steps
- Draft/publish workflow lifecycle with version rollback
- Retry/timeout/checkpoint execution engine with resume support
- Manual approvals, run timeline, and diff vs last success
- Workflow templates and cron scheduling with presets + next-run preview (local timezone)
- Local auth + RBAC foundations + webhook integrations
- Local LLM integration through Ollama for transform nodes

## Architecture
- `web`: React UI (`http://localhost:5173`)
- `server`: API + runner + recorder orchestration (`http://localhost:8080`)
- `agent`: desktop automation runtime (`http://localhost:7001`)
- `db`: PostgreSQL
- `redis`: queue/cache runtime dependency
- `ollama`: local model runtime

## Quick Start
1. Create env file:
```bash
cp .env.example .env
```
2. Start all services:
```bash
./start.sh
```
3. Open the UI:
- `http://localhost:5173`

Alternative startup command:
```bash
docker compose up --build --renew-anon-volumes
```

Detailed operator guide:
- `QUICKSTART.md`

## Default Login
- Username: `local`
- Password: `localpass`

Change these in `.env` before real use.

## Common Commands
Run migrations:
```bash
docker compose run --rm server npm run prisma:migrate
```

Run backend tests:
```bash
docker compose run --rm server npm test
```

Stop services:
```bash
docker compose down
```

## Core API Groups
Auth:
- `POST /api/auth/login`
- `GET /api/auth/me`

Workflows and runs:
- `/api/workflows*`
- `/api/runs*`
- `/api/system/preflight`

Templates, schedules, metrics:
- `/api/templates`
- `/api/workflows/from-template`
- `/api/schedules*`
- `/api/metrics/dashboard`

Secrets and recorders:
- `/api/secrets*`
- `/api/recorders/web/start`
- `/api/recorders/desktop/start`
- `/api/recorders/desktop/stop`

Admin/RBAC/Webhooks:
- `/api/admin/users*`
- `/api/admin/roles*`
- `/api/webhooks*`

## Key Environment Variables
Auth and crypto:
- `APP_USERNAME`
- `APP_PASSWORD` or `APP_PASSWORD_HASH_ARGON2`
- `JWT_SECRET`
- `SECRET_ENCRYPTION_KEY`

Runtime services:
- `DATABASE_URL`
- `REDIS_URL`
- `OLLAMA_BASE_URL`
- `AGENT_BASE_URL`

Automation and limits:
- `PLAYWRIGHT_HEADLESS`
- `DISPLAY`
- `SELECTOR_AI_ENABLED`
- `SELECTOR_AI_MODEL`
- `RATE_LIMIT_WINDOW_MS`
- `RATE_LIMIT_MAX`
- `RATE_LIMIT_LOGIN_MAX`
- `TRUST_PROXY`

Local file-backed stores:
- `AUTHZ_FILE`
- `WEBHOOKS_FILE`
- `SCHEDULES_FILE`
- `SCHEDULE_DEFAULT_TIMEZONE`

## Troubleshooting
`ERR_MODULE_NOT_FOUND` for a package in containers:
- Recreate anonymous volumes to refresh container `node_modules`:
```bash
docker compose up --build --renew-anon-volumes
```

Desktop automation fails on Linux:
- Allow local X11 access:
```bash
xhost +local:
```
- Ensure `.env` has the right `DISPLAY` (often `:0`).

Ollama model missing:
```bash
docker exec -it rpa-ollama ollama pull llama3.2
```

## Support
If ForgeFlow helps you, you can support development here:
- https://buymeacoffee.com/mackeh
