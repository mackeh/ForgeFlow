# ForgeFlow

ForgeFlow is a local-first RPA platform for web and desktop automation with a visual node graph, resilient runs, approvals, schedules, templates, local LLM transforms, and operational diagnostics.

ForgeFlow is a **highly sophisticated, production-ready RPA platform** with excellent code quality, comprehensive features, and robust error handling. The application demonstrates professional engineering practices and is suitable for production deployment.

## Highlights
- Visual node-graph workflow builder (React Flow)
- Web automation with Playwright and desktop automation with the local agent
- Draft and publish lifecycle with version history and rollback
- Robust execution engine with retries, timeouts, checkpoints, resume-from-failure
- Manual approval nodes, run logs, run diff vs last success
- Advanced control-flow nodes: conditional branch, loop iterate, parallel execute
- Run diagnostics panel with failed-node summaries and screenshot/DOM artifact previews
- Built-in workflow templates and local-time scheduling
- Schedule presets and next-run preview before saving
- Schedule dependency chains and maintenance windows
- Daily/hourly performance trends, failure analysis, and server resource usage dashboard
- Local auth, role permissions, webhook events, rate limiting
- Enterprise collaboration: live viewer/editor presence, workflow comments, attributed change history
- Data source integrations: connector registry, connectivity test, CSV import utility, integration request node
- Visual regression testing node with baseline capture and threshold-based comparison
- Enhanced debugging: variable inspector, network inspector, screenshot/DOM/visual artifact galleries
- Optional TOTP 2FA with setup/verify/disable flow and QR setup link
- Persistent audit logging with admin audit viewer/API
- Local LLM data transform support via Ollama
- Structured JSON request logs, request IDs for traceability, and Prometheus-compatible `/metrics` endpoint

## Priority Status
Priority 1 (`Quick Wins`) is implemented:
- Health/readiness probes (`/health`, `/ready`) plus startup login protection
- Graceful shutdown (`SIGINT`/`SIGTERM`) with active-run drain timeout
- Enhanced toasts (animated, stacked, action button support)
- Smart node positioning, auto-connect, keyboard shortcuts
- Workflow JSON import/export in the UI

Priority 2 (`Game-Changing Features`) is implemented:
- Advanced automation nodes (`conditional_branch`, `loop_iterate`, `parallel_execute`)
- Real-time execution visualization (node status colors + runtime + diagnostics progress)
- AI-assisted selector fallback generation with multiple candidate strategies
- Performance dashboard (summary, daily/hourly trends, top failures, top risk workflows, resource usage)
- Enhanced scheduling (calendar/upcoming runs, presets, dependency chains, maintenance windows)
- Workflow template library (web/data/desktop patterns)

Priority 3 (`Enterprise Features`) is implemented:
- Multi-user collaboration primitives (presence + comments + change history with attribution)
- Data source integration framework (PostgreSQL/MySQL/MongoDB/HTTP API/Airtable/S3/Sheets profiles + test endpoint)
- Visual regression testing support via `playwright_visual_assert`
- Enhanced debugging tools (variable inspector + network inspector + artifact galleries)
- Two-factor authentication (TOTP) and compliance-grade audit trails
- Observability enhancements with request IDs in logs/audit metadata

## Recent Updates
- Added persistent audit logging with retention controls (`AUDIT_FILE`, `AUDIT_MAX_EVENTS`)
- Added schedule presets and local-time next-run preview
- Added admin audit endpoint and sidebar audit log viewer
- Added observability primitives: structured logs and Prometheus metrics export
- Added startup-ready login guard to prevent transient auth/API errors during boot
- Added collaboration APIs/WebSocket presence and workflow comments/history
- Added integration registry/test APIs and CSV import helper
- Added TOTP-based 2FA setup/verify/disable with login enforcement
- Added request ID propagation for traceable logs and audit events

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

## Documentation
- Docs index: `docs/README.md`
- Architecture: `docs/ARCHITECTURE.md`
- API reference: `docs/API_REFERENCE.md`
- Deployment guide (including Kubernetes starter manifests): `docs/DEPLOYMENT.md`
- Contributing guide: `docs/CONTRIBUTING.md`

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
- `LOG_LEVEL`, `REQUEST_LOGS`
- `SELECTOR_AI_ENABLED`, `SELECTOR_AI_MODEL`
- `AUTHZ_FILE`, `WEBHOOKS_FILE`, `SCHEDULES_FILE`, `SCHEDULE_DEFAULT_TIMEZONE`
- `AUDIT_FILE`, `AUDIT_MAX_EVENTS`

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
- Schedules: `/api/schedules`, `/api/schedules/presets`, `/api/schedules/preview?cron=<expr>&timezone=<tz>`
- Schedule calendar: `/api/schedules/upcoming?workflowId=<id>&days=14&limit=80&perSchedule=6`
- Metrics: `/api/metrics/dashboard`
- Runtime metrics: `/metrics` (Prometheus text format)
- Collaboration: `/api/workflows/:id/collab/presence`, `/api/workflows/:id/comments`, `/api/workflows/:id/history`
- Integrations: `/api/integrations*`, `/api/integrations/:id/test`, `/api/integrations/import/csv`
- 2FA: `/api/auth/2fa/status`, `/api/auth/2fa/setup`, `/api/auth/2fa/verify-setup`, `/api/auth/2fa/disable`
- Secrets: `/api/secrets*`
- Recorders: `/api/recorders/web/start`, `/api/recorders/desktop/start`, `/api/recorders/desktop/stop`
- Admin/RBAC: `/api/admin/users*`, `/api/admin/roles*`
- Audit: `/api/admin/audit?limit=100&actorUsername=<user>&action=<prefix>&resourceType=<type>&success=true|false`
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
