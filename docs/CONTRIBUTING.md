# Contributing to ForgeFlow

This guide standardizes local setup, coding practices, and contribution workflow.

Start here if you are new:
- `docs/ONBOARDING.md` for the fastest first-PR path.
- `docs/DEMOS.md` for repeatable product walkthrough flows.
- `CODE_OF_CONDUCT.md` for expected behavior in community interactions.

## 1. Prerequisites

- Docker + Docker Compose
- Node.js 20+ (for local non-container development)
- Python 3.11+ (for local agent work)
- Linux desktop/X11 setup if working on desktop automation flows

## 2. Development Setup

## Option A: Recommended (Docker)

```bash
./start.sh
```

## Option B: App-by-app local development

Server:

```bash
cd apps/server
npm install
npm run prisma:generate
npm run dev
```

Web:

```bash
cd apps/web
npm install
npm run dev
```

Agent:

```bash
cd apps/agent
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 7001
```

## 3. Project Layout

- `apps/web`: React/Vite frontend, node graph UI, diagnostics panels.
- `apps/server`: Express API, runner, scheduler, auth, stores, metrics.
- `apps/server/prisma`: schema + migrations.
- `apps/agent`: FastAPI desktop automation service.
- `docs`: architecture/API/deployment/contribution docs.
- `deploy/k8s`: Kubernetes starter manifests.

## 4. Code Standards

- TypeScript and Python code should be explicit and readable.
- Keep functions focused; avoid large multi-responsibility handlers.
- Prefer schema validation (`zod`) for new API inputs.
- For protected endpoints, always apply `requirePermission`.
- Write audit events for security-sensitive or admin actions.
- Keep log entries structured and actionable.
- Avoid introducing magic constants; use named config/env values.

## 5. Testing Expectations

## Backend tests

```bash
docker compose run --rm server npm test
```

Critical path subset:

```bash
docker compose run --rm server npm run test:critical
```

Web UI tests:

```bash
cd apps/web
npm test
```

Test locations:
- `apps/server/src/**/*.test.ts`

When adding features:
- Add/extend unit tests for new logic.
- Add API behavior tests for validation/permission edges where feasible.
- For run-engine features, include success and failure-path coverage.

## 6. Manual QA Checklist

Before submitting:
- [ ] Login/logout flow works.
- [ ] Workflow create/edit/save/publish works.
- [ ] Quick-add node search works (`Ctrl/Cmd+K`, type, `Enter`).
- [ ] Duplicate selected node works (`Ctrl+D` and toolbar button).
- [ ] Autopilot workflow generation works from sidebar prompt.
- [ ] Orchestrator robot/job queue flow works (create robot, queue job, dispatch/sync).
- [ ] Process mining panel loads and shows opportunities/bottlenecks.
- [ ] Test run and production run both work.
- [ ] Approval/resume behavior works for `manual_approval`.
- [ ] Run diagnostics logs/artifacts render correctly.
- [ ] Document understanding and clipboard AI transfer nodes validate and run as expected.
- [ ] New UI interactions show success/error feedback.
- [ ] No regressions in schedule and template flows.

## 7. Pull Request Guidelines

- Use focused commits and clear messages.
- Include what changed, why, and how to validate.
- Include screenshots/GIFs for UI behavior changes.
- Mention any migration or env var changes explicitly.
- Update `README.md`, `QUICKSTART.md`, and/or `docs/*` when behavior changes.

## 8. Security and Secrets

- Never commit real secrets or personal credentials.
- Use `.env.example` for new config keys.
- If adding auth, RBAC, webhook, or secret features, include abuse-case considerations and tests.

## 9. Documentation Rule

Feature work is not complete until:
- API changes are reflected in `docs/API_REFERENCE.md`.
- architecture-impacting changes are reflected in `docs/ARCHITECTURE.md`.
- deployment-impacting changes are reflected in `docs/DEPLOYMENT.md`.
