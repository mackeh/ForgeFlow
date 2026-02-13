# Repository Guidelines

## Project Structure & Module Organization
- `apps/web`: React + Vite frontend (workflow canvas, inspector, sidebars, API client in `src/api.ts`).
- `apps/server`: Express + TypeScript API, run engine, scheduler, RBAC, and observability (`src/lib/*`).
- `apps/server/prisma`: database schema and migrations.
- `apps/agent`: FastAPI desktop automation bridge.
- `docs`: architecture, API, deployment, demos, onboarding, and contribution docs.
- `.github`: issue templates and PR template.

## Build, Test, and Development Commands
- `./start.sh`: recommended full local stack bootstrap (DB migration + Docker services).
- `AUTO_UPDATE=0 ./start.sh`: start without pulling/updating images.
- `cd apps/server && npm test`: server unit/integration tests.
- `cd apps/server && npm run build`: TypeScript compile check for server.
- `cd apps/web && npm test`: UI tests (Vitest).
- `cd apps/web && npm run build`: production web build check.
- `docker compose logs -f`: follow runtime logs.

## Coding Style & Naming Conventions
- TypeScript uses ESM modules, explicit typing, and 2-space indentation.
- Keep route validation in `zod` and business logic in `apps/server/src/lib`.
- Name functions by behavior (`buildMiningSummary`, `createOrchestratorJob`).
- Prefer focused modules over large multi-purpose files.
- For UI, keep node types and labels aligned across:
  - `apps/web/src/lib/nodeCatalog.ts`
  - `apps/server/src/lib/activities.ts`
  - `apps/server/src/lib/runner.ts`

## Testing Guidelines
- Add/extend `*.test.ts` beside server logic.
- Cover success and failure paths for new nodes/endpoints.
- For run-engine changes, include behavior tests in `apps/server/src/lib/execution-flows.test.ts`.
- Validate both test and production build paths before PR.

## Commit & Pull Request Guidelines
- Use concise, imperative commit messages (`feat(orchestrator): add job sync endpoint`).
- Keep commits scoped by concern (server, web, docs, infra).
- Use `.github/pull_request_template.md` and include:
  - change summary and rationale
  - exact validation commands
  - screenshots/GIFs for UI updates
  - docs updates and risk/rollback notes

## Security & Documentation Standards
- Never commit real credentials; document new env vars in `.env.example`.
- Enforce permission checks for protected endpoints and write audit events for sensitive actions.
- If behavior/API changes, update `README.md`, `docs/API_REFERENCE.md`, and relevant docs (`docs/ARCHITECTURE.md`, `docs/DEMOS.md`, `docs/ONBOARDING.md`, `docs/CONTRIBUTING.md`).
