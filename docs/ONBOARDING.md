# Contributor Onboarding

This guide helps new contributors ship a first high-quality PR quickly.

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

## 3. Do the 10-Minute Tutorial First
Use the guided tutorial and starter workflow:
- `docs/tutorials/FIRST_AUTOMATION_10_MIN.md`
- `docs/examples/workflows/first-automation.workflow.json`

In-app guidance:
- Use `Starter Walkthrough` in the sidebar for the guided template -> setup -> test -> publish flow.
- Use `Template Setup Wizard` inside `Templates` before creating from starter packs.

This gives you a known-good baseline before deeper changes.

## 4. Choose a Contribution Track

### Web/UI track
- Primary files: `apps/web/src/*`
- Typical work: canvas UX, inspector fields, sidebar features
- Required validation:
```bash
cd apps/web && npm test && npm run build
```

### Server/Runtime track
- Primary files: `apps/server/src/*`
- Typical work: runner nodes, APIs, authz, orchestrator logic
- Required validation:
```bash
cd apps/server && npm test && npm run build
```

### Docs/Enablement track
- Primary files: `README.md`, `docs/*`, `.github/*template*`
- Typical work: tutorials, examples, contribution process, demo scripts
- Required validation: link/command accuracy and consistency with current behavior

## 5. Use Repository Templates
Start from templates in `docs/templates` when relevant:
- `activity-proposal.md`
- `node-implementation-checklist.md`
- `demo-script-template.md`

## 6. Pull Request Path
1. Create branch:
```bash
git checkout -b feat/<short-topic>
```
2. Implement focused changes.
3. Run required validation for your track.
4. Update docs affected by behavior/API/UI changes.
5. Fill `.github/pull_request_template.md` completely.

## 7. Definition of Done (Required)
- [ ] Changes are scoped and reviewable.
- [ ] Required tests/builds pass.
- [ ] User-facing/API behavior is documented.
- [ ] Demo/tutorial updates are included when UX flows change.
- [ ] PR includes rollback/risk notes.

## 8. Where to Ask Questions
- Open a draft PR early with assumptions.
- Link exact files and failing commands.
- Keep scope explicit to reduce review churn.

Tip: prefer small PRs (<300 changed lines) unless the feature requires a larger vertical slice.
