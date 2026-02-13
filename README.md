# ForgeFlow

[![CI](https://github.com/mackeh/ForgeFlow/actions/workflows/ci.yml/badge.svg)](https://github.com/mackeh/ForgeFlow/actions/workflows/ci.yml)

ForgeFlow is a local-first automation platform for web and desktop workflows.

It combines a drag-and-drop workflow studio, resilient execution, AI-assisted automation, and centralized operations in one stack.

## What You Get
- Visual workflow builder (React Flow)
- Web automation (Playwright) and desktop automation (agent service)
- Recorder flows for web and desktop action capture
- Autopilot workflow generation from natural-language prompts
- AI nodes: `transform_llm`, `document_understanding`, `clipboard_ai_transfer`
- Integrations (`http_api`, `postgresql`, `mysql`, `mongodb`, `google_sheets`, `airtable`, `s3`)
- Orchestrator queue with attended/unattended robots and dispatch lifecycle
- Process/task mining summary (bottlenecks, variants, opportunity scoring)
- Draft/publish lifecycle, rollback, schedules, approvals, and resume-from-failure
- RBAC, optional TOTP 2FA, encrypted secrets, audit log, webhooks, Prometheus metrics

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
4. Build your first flow and run `Test Run`

Power shortcuts:
- `Ctrl/Cmd+K` quick-add node search
- `Ctrl+S` save draft
- `Ctrl+T` test run
- `Ctrl+R` run
- `Ctrl+D` duplicate selected node

## Demo Flows
Use these guided demos to evaluate the platform quickly:
- `docs/DEMOS.md#demo-1-autopilot-invoice-triage`
- `docs/DEMOS.md#demo-2-orchestrator-unattended-queue`
- `docs/DEMOS.md#demo-3-document-understanding-and-clipboard-ai`

## Contributor Onboarding
New contributors should start here:
1. `docs/ONBOARDING.md` (30-minute setup + first contribution path)
2. `docs/CONTRIBUTING.md` (standards, testing, QA checklist)
3. `.github/pull_request_template.md` (PR structure used in this repo)

Good first areas:
- UI polish and node inspector UX (`apps/web/src`)
- New activity handlers (`apps/server/src/lib/runner.ts`)
- New API endpoints with `zod` validation (`apps/server/src/index.ts`)
- Docs and tutorials (`docs/*`)

## Development Commands
Start stack:
```bash
./start.sh
```

Start without auto-update:
```bash
AUTO_UPDATE=0 ./start.sh
```

Run backend tests:
```bash
cd apps/server && npm test
```

Run web tests:
```bash
cd apps/web && npm test
```

Run web Playwright smoke tests:
```bash
cd apps/web && npx playwright install --with-deps chromium && npm run test:e2e
```

Build server + web:
```bash
cd apps/server && npm run build
cd apps/web && npm run build
```

Stop stack:
```bash
docker compose down
```

## Documentation Map
- `docs/README.md`
- `docs/DEMOS.md`
- `docs/ONBOARDING.md`
- `docs/ARCHITECTURE.md`
- `docs/API_REFERENCE.md`
- `docs/DEPLOYMENT.md`
- `docs/CONTRIBUTING.md`
- `AGENTS.md` (repository contributor guide)
- `CODE_OF_CONDUCT.md`
- `LICENSE`

## API Areas
- Auth: `/api/auth/*`
- Workflows: `/api/workflows*`
- Runs: `/api/runs*`
- Templates/Autopilot: `/api/templates`, `/api/activities`, `/api/autopilot/plan`
- Document AI: `/api/document/understand`
- Orchestrator: `/api/orchestrator/*`
- Mining: `/api/mining/summary`
- Schedules: `/api/schedules*`
- Integrations: `/api/integrations*`
- Metrics dashboard: `/api/metrics/dashboard`
- Prometheus metrics: `/metrics`
- Secrets/Webhooks/Admin: `/api/secrets*`, `/api/webhooks*`, `/api/admin/*`

## Troubleshooting
Module mismatch in containers:
```bash
docker compose up --build --renew-anon-volumes
```

Desktop automation issues on Linux:
```bash
xhost +local:
```
Then verify `.env` `DISPLAY` (usually `:0`).

Missing Ollama model:
```bash
docker exec -it rpa-ollama ollama pull llama3.2
```

## Support
- https://buymeacoffee.com/mackeh

## Community Standards
- Code of Conduct: `CODE_OF_CONDUCT.md`
- License: `LICENSE` (MIT)
