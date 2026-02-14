# Contributing to ForgeFlow

This guide standardizes setup, engineering quality, and PR delivery.

Start here if new:
- `docs/ONBOARDING.md`
- `docs/tutorials/FIRST_AUTOMATION_10_MIN.md`
- `CODE_OF_CONDUCT.md`

## 1. Prerequisites
- Docker + Docker Compose
- Node.js 20+
- Python 3.11+ (for `apps/agent` work)

## 2. Development Setup

Recommended:
```bash
./start.sh
```

App-by-app local setup:

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
- `apps/web`: React/Vite UI and workflow builder
- `apps/server`: Express API, runner, scheduler, auth, stores
- `apps/server/prisma`: schema and migrations
- `apps/agent`: FastAPI desktop bridge
- `docs`: architecture/API/deployment/onboarding

## 4. Contribution Paths by Change Type

### A. Web/UI Changes
- Touchpoints: `apps/web/src/*`
- Also update: screenshots/GIFs in PR for behavior changes
- Required validation:
```bash
cd apps/web && npm test && npm run build
```

### B. Server/API/Runner Changes
- Touchpoints: `apps/server/src/*`
- Expectations:
  - add input validation (`zod`) for new API contracts
  - apply permission checks for protected endpoints
  - write audit events for sensitive/admin operations
- Required validation:
```bash
cd apps/server && npm test && npm run build
```

### C. Docs/Community Changes
- Touchpoints: `README.md`, `docs/*`, `.github/*template*`
- Expectations:
  - commands and paths are runnable/accurate
  - docs reflect current merged behavior

## 5. Templates for Consistency
Use these templates when applicable:
- `docs/templates/activity-proposal.md`
- `docs/templates/node-implementation-checklist.md`
- `docs/templates/demo-script-template.md`

## 6. Testing and CI
CI in `.github/workflows/ci.yml` runs on PRs and `main` pushes:
- `Server Test and Build`
- `Web Test and Build`
- `Web E2E Smoke`

Recommended full local validation before review:
```bash
cd apps/server && npm test && npm run build
cd apps/web && npm test && npm run build
```

## 7. Definition of Done
A PR is done only when all are true:
- [ ] Scope is focused and the title/description are clear.
- [ ] Required tests/build commands pass.
- [ ] API/UI behavior changes are documented.
- [ ] `CHANGELOG.md` updated for user-visible changes.
- [ ] Risk and rollback notes are included in PR.

## 8. Pull Request Guidelines
- Branch naming: `feat/<topic>`, `fix/<topic>`, `docs/<topic>`.
- Commit messages: concise, imperative (`feat(recorder): add draft review panel`).
- Use `.github/pull_request_template.md`.
- Include:
  - what changed and why
  - exact validation commands run
  - screenshots/GIFs for UI changes
  - docs updated

## 9. Release Flow
From `main`, create the next tag:
- `npm run release:patch`
- `npm run release:minor`
- `npm run release:major`

Tag push triggers `.github/workflows/release.yml` and publishes GitHub release notes.

## 10. Security and Secrets
- Never commit real secrets.
- Add new env vars to `.env.example`.
- For auth/RBAC/webhooks/secrets changes, include abuse-case considerations and tests.
