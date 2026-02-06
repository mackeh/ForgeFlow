# ForgeFlow Quick Start Manual

This guide gets a single-user local setup running fast and shows the main workflow path.

## 1. Start the platform

From project root:

```bash
./start.sh
```

What `start.sh` does:
- Creates `.env` from `.env.example` if missing
- Tries `xhost +local:` for desktop automation unless `AUTO_X11_AUTH=0`
- Runs DB migration
- Starts all services with Docker Compose
- Auto-updates images/rebuilds unless `AUTO_UPDATE=0`

Open UI:
- `http://localhost:5173`

## 2. Log in

Credentials come from `.env`:
- `APP_USERNAME`
- `APP_PASSWORD`

Default values:
- Username: `local`
- Password: `localpass`

## 3. Create your first workflow

1. Click `New` in the left sidebar.
2. Add nodes from the top toolbar.
3. Select each node and configure fields in `Inspector`.
4. Click `Save Draft`.

Recommended first chain:
1. `start`
2. `playwright_navigate`
3. `playwright_fill`
4. `playwright_click`
5. `playwright_extract`
6. `submit_guard`

Tips:
- Use `Auto Layout` to reorganize nodes quickly.
- Use `Snap: On/Off` depending on precision vs free placement.
- Use `Ctrl+S` save, `Ctrl+T` test run, `Ctrl+R` run.

## 4. Run lifecycle (test, publish, production)

1. `Save Draft`
2. `Test Run` (runs draft definition)
3. `Publish` (promotes draft)
4. `Run` (runs published definition)

If a run fails:
- Use `Resume From Failed Run` to continue from checkpoint when available.
- Use `Diff vs Last Success` to inspect behavior changes.

If a run pauses at `manual_approval`:
- Click `Approve Waiting Node` in run controls.

## 5. Use recording

### Web recording
1. Click `Record Web`.
2. Perform actions in recorder browser.
3. Recorded steps are added to the graph.

### Desktop recording
1. Click `Record Desktop`.
2. Perform desktop actions.
3. Click `Stop Desktop`.
4. Recorded desktop nodes are added (image target + confidence).

Linux note:
```bash
xhost +local:
```
- Ensure `.env` has correct `DISPLAY` (usually `:0`).

## 6. Use templates

1. Open `Templates` in the left panel.
2. Search or filter by category.
3. Select a template and click `Create From Template`.

## 7. Configure schedules (local time)

1. Open `Schedules` section.
2. Choose a preset, click `Use Preset`, or type your own cron.
3. Set timezone.
4. Verify `Next run` preview.
5. Click `Add Schedule`.

Schedule management:
- `Run now`
- `Enable`/`Disable`
- `Delete`
- Card shows last run time/status/error

## 8. Secrets and LLM transforms

Add secrets:
1. Enter key/value in `Secrets` panel.
2. Click `Save Secret`.

Reference secret in node fields:
- `{{secret:MY_KEY}}`

Use local LLM transform node:
- Add `transform_llm`
- Map `inputKey` and `outputKey`
- Ensure Ollama is up and model is pulled

Pull model once:

```bash
docker exec -it rpa-ollama ollama pull llama3.2
```

## 9. Admin features

For admin users:
- Manage users (create/disable/delete)
- Update role permissions
- Manage webhook subscriptions

Common webhook events:
- `run.started`
- `run.succeeded`
- `run.failed`
- `run.waiting_approval`

## 10. Useful commands

Start without auto-update:

```bash
AUTO_UPDATE=0 ./start.sh
```

Tune rate limits:

```bash
RATE_LIMIT_WINDOW_MS=900000 RATE_LIMIT_MAX=300 RATE_LIMIT_LOGIN_MAX=25 ./start.sh
```

Show logs:

```bash
docker compose logs -f
```

Stop all services:

```bash
docker compose down
```

Rebuild clean container node modules (fix module errors):

```bash
docker compose up --build --renew-anon-volumes
```

## 11. Troubleshooting

Login fails:
- Verify `APP_USERNAME` and `APP_PASSWORD` in `.env`.
- If using `APP_PASSWORD_HASH_ARGON2`, use the original plaintext password to log in.

Desktop actions fail:
- Confirm `xhost +local:`
- Confirm `DISPLAY` in `.env`
- Re-record image-based steps if UI/theme changed

Port conflict on Ollama (`11434`):
- Stop conflicting host service or change mapping in `docker-compose.yml`.

Workflow appears stuck:
- Check in-app log window and toast errors
- Check backend logs:
```bash
docker compose logs -f server agent
```
