# Repository Guidelines

## Project Structure & Module Organization
- `apps/web`: React + Vite frontend (`src/components`, `src/api.ts`, canvas UI in `src/App.tsx`).
- `apps/server`: Express + TypeScript API and run engine (`src/lib/*.ts`), with Prisma schema/migrations in `prisma/`.
- `apps/agent`: FastAPI desktop automation service (`main.py`).
- `docs/`: architecture, API, deployment, and contribution docs.
- `deploy/k8s/`: starter Kubernetes manifest.
- Root scripts/config: `start.sh`, `docker-compose.yml`, `.env.example`.

## Build, Test, and Development Commands
- `./start.sh`: recommended local startup (builds/starts full Docker stack, runs migrations).
- `AUTO_UPDATE=0 ./start.sh`: start without image auto-update.
- `docker compose down`: stop all services.
- `docker compose logs -f`: tail stack logs.
- `docker compose run --rm server npm test`: run backend test suite in container.
- Local app-by-app dev:
  - `cd apps/server && npm install && npm run dev`
  - `cd apps/web && npm install && npm run dev`
  - `cd apps/agent && pip install -r requirements.txt && uvicorn main:app --host 0.0.0.0 --port 7001`
- UI power-use shortcuts: `Ctrl/Cmd+K` quick-add search, `Ctrl+S` save draft, `Ctrl+T` test run, `Ctrl+R` run, `Ctrl+D` duplicate node.

## Coding Style & Naming Conventions
- TypeScript uses ESM modules, explicit types, and 2-space indentation.
- Keep modules focused; prefer small helpers in `apps/server/src/lib`.
- Validate API input with `zod` for new endpoints.
- Test files use `*.test.ts` and are colocated with server logic.
- Use clear, descriptive names (`schedulePreview`, `integrationStore`, `requirePermission`).

## Testing Guidelines
- Framework: Node test runner (`node --test`) executed via `tsx` in `apps/server`.
- Run all server tests: `cd apps/server && npm test` (or Docker command above).
- Critical regression subset: `cd apps/server && npm run test:critical`.
- Coverage gate: no numeric threshold is enforced; new features should include success and failure-path tests on critical flows.

## Commit & Pull Request Guidelines
- Follow the existing history style: concise, imperative, and preferably Conventional Commit-like (`fix(ui): ...`, `docs: ...`, `refactor: ...`).
- Keep commits focused by concern (UI, API, docs, security).
- PRs should include:
  - what changed and why
  - how to validate (commands/endpoints)
  - screenshots/GIFs for UI changes
  - notes for migrations, env vars, or breaking behavior
  - documentation updates in `README.md`, `QUICKSTART.md`, or `docs/*` when behavior changes

## Security & Configuration Tips
- Never commit real credentials; use `.env.example` for new config keys.
- For auth/RBAC/webhook/secrets changes, include abuse-case and permission-path tests.
- On Linux desktop automation, verify X11 access (`xhost +local:`) and `DISPLAY` in `.env`.
