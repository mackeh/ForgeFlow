# Contributor Onboarding

This guide helps new contributors deliver a first high-quality PR quickly.

## 1. Prerequisites
- Docker + Docker Compose
- Node.js 20+
- Python 3.11+ (only if working on `apps/agent`)

## 2. Boot the Project
```bash
./start.sh
```

Open:
- UI: `http://localhost:5173`
- API health: `http://localhost:8080/ready`

Default local login:
- username: `local`
- password: `localpass`

## 3. Understand the Repo Fast
- `apps/web`: workflow studio UI
- `apps/server`: API, runner, scheduling, auth, orchestration
- `apps/agent`: desktop automation bridge
- `docs`: architecture, API, deployment, contribution docs

## 4. Choose a First Task
Recommended starter contributions:
- UI improvements in `apps/web/src/components`
- Add/extend node behavior in `apps/server/src/lib/runner.ts`
- Add endpoint + tests in `apps/server/src/index.ts` + `src/lib/*.test.ts`
- Improve docs/tutorials in `docs/*`

## 5. Development Workflow
1. Create branch
```bash
git checkout -b feat/<short-topic>
```
2. Implement change
3. Run validation:
```bash
cd apps/server && npm test && npm run build
cd apps/web && npm test && npm run build
```
4. Update docs for behavior/API changes
5. Commit with clear message (example: `feat(orchestrator): add queue status sync`)

## 6. Pull Request Checklist
Use `.github/pull_request_template.md` and include:
- What changed and why
- How to test (exact commands)
- Screenshots/GIF for UI changes
- Docs updates performed
- Risk/rollback notes for non-trivial changes

## 7. Community Standards in This Repo
- Keep commits focused and reviewable.
- Add tests for new logic and edge cases.
- Validate permissions for protected API changes.
- Write audit events for sensitive/admin actions.
- Keep docs current with features.

## 8. Where to Ask Questions
- Open a draft PR early with assumptions.
- Link relevant files and failing tests directly.
- Keep scope explicit to speed up review.
