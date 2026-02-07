# ForgeFlow Quickstart

This guide is for single-user local setup and first successful workflow execution.

## 1. Start the Platform
From repo root:

```bash
./start.sh
```

Then open:
- `http://localhost:5173`

Sign in using `.env` credentials:
- default username: `local`
- default password: `localpass`

## 2. Verify Readiness
Optional but recommended:

```bash
curl -sS http://localhost:8080/ready
```

Expected: `"ready": true`

## 3. Create a Workflow
1. Click `New`.
2. Add nodes from the top toolbar.
3. Select each node and configure it in `Inspector`.
4. Click `Save Draft`.

Suggested first chain:
1. `start`
2. `playwright_navigate`
3. `playwright_fill`
4. `playwright_click`
5. `playwright_extract`
6. `submit_guard`

Shortcuts:
- `Ctrl+S` save draft
- `Ctrl+T` test run
- `Ctrl+R` run published
- `Delete` remove selected node
- `Space` auto layout

## 4. Run Lifecycle
1. `Save Draft`
2. `Test Run`
3. `Publish`
4. `Run`

If run fails:
- use `Resume From Failed Run`
- use `Diff vs Last Success`
- inspect `Run Diagnostics` (errors, network logs, artifacts)

If run is paused on `manual_approval`:
- click `Approve Waiting Node`

## 5. Recording
Web recorder:
1. Click `Record Web`
2. Perform actions in the recorder browser
3. Recorded steps are added to the graph

Desktop recorder:
1. Click `Record Desktop`
2. Perform desktop actions
3. Click `Stop Desktop`
4. Recorded desktop nodes are added

Linux desktop note:
```bash
xhost +local:
```
Also verify `.env` `DISPLAY` (usually `:0`).

## 6. Templates, Schedules, and Integrations
Templates:
- choose template in sidebar
- click `Create From Template`

Schedules:
- set cron + timezone
- optional dependency chain
- optional maintenance windows
- verify next-run preview
- click `Add Schedule`

Integrations:
- create connector profile
- test it
- use via `integration_request` node

## 7. Secrets and LLM Transform
Save secret:
- sidebar `Secrets`
- add key/value

Reference in nodes:
- `{{secret:MY_KEY}}`

Use LLM node:
- add `transform_llm`
- set `inputKey` and `outputKey`
- ensure Ollama model is available:

```bash
docker exec -it rpa-ollama ollama pull llama3.2
```

## 8. Admin and Security
Admin capabilities:
- users
- roles
- webhooks
- audit log

2FA (TOTP):
1. `Start 2FA Setup`
2. scan QR in authenticator app
3. verify with 6-digit token

## 9. Useful Commands
Start without auto-update:
```bash
AUTO_UPDATE=0 ./start.sh
```

Run backend tests:
```bash
docker compose run --rm server npm test
```

Tail logs:
```bash
docker compose logs -f
```

Prometheus metrics preview:
```bash
curl -sS http://localhost:8080/metrics | head -n 40
```

Stop everything:
```bash
docker compose down
```

## 10. If Something Fails
Login problems:
- verify `APP_USERNAME` and `APP_PASSWORD` in `.env`

Desktop automation problems:
- run `xhost +local:`
- verify `DISPLAY` in `.env`

Container module mismatch:
```bash
docker compose up --build --renew-anon-volumes
```

Workflow appears stuck:
```bash
docker compose logs -f server agent
```

## 11. Next Docs
- `docs/ARCHITECTURE.md`
- `docs/API_REFERENCE.md`
- `docs/DEPLOYMENT.md`
