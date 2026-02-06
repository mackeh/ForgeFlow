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

## 3. Verify readiness (recommended)

```bash
curl -sS http://localhost:8080/ready
```

Expected: `"ready": true`

## 4. Create your first workflow

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
- Use `parallel_execute` when you need fan-out tasks (HTTP/set-variable/LLM) in one node.

## 5. Run lifecycle (test, publish, production)

1. `Save Draft`
2. `Test Run` (runs draft definition)
3. `Publish` (promotes draft)
4. `Run` (runs published definition)

If a run fails:
- Use `Resume From Failed Run` to continue from checkpoint when available.
- Use `Diff vs Last Success` to inspect behavior changes.
- Open `Run Diagnostics` to inspect failed nodes, latest errors, screenshot previews, and DOM snapshots.

If a run pauses at `manual_approval`:
- Click `Approve Waiting Node` in run controls.

## 6. Use recording

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

## 7. Import or export workflow files

In the left sidebar (`Workflow` section):
- `Save Workflow File` exports current workflow JSON
- `Load Workflow File` imports a workflow JSON as a new workflow

## 8. Use templates

1. Open `Templates` in the left panel.
2. Search or filter by category.
3. Select a template and click `Create From Template`.

## 9. Configure schedules (local time)

1. Open `Schedules` section.
2. Choose a preset, click `Use Preset`, or type your own cron.
3. Set timezone.
4. Optional: select `Depends on` to build schedule chains.
5. Optional: enable `Maintenance window` to skip executions during blocked periods.
6. Verify `Next run` preview.
7. Click `Add Schedule`.

Schedule management:
- `Run now`
- `Enable`/`Disable`
- `Delete`
- Card shows last run time/status/error
- `Upcoming Calendar` groups upcoming runs by local date

## 10. Monitor performance and resources

The dashboard (top of canvas) now includes:
- Daily run trend (volume and success rate)
- Error analysis (top failing nodes)
- Resource usage (memory, load average, active runs, uptime)

Use the window selector (`1/7/14/30 days`) and `Refresh` for updated analytics.

## 11. Build advanced automation flows

Use these node patterns for resilient orchestration:
- `conditional_branch`: route by rule (`truthy`, `eq`, `gt`, etc.), then set `trueTarget`/`falseTarget`
- `loop_iterate`: process arrays with `itemKey`/`indexKey`, optional inline tasks, and `allowPartial`
- `parallel_execute`: run independent inline tasks concurrently, with per-task timeout and partial mode

Practical recipe:
1. Add `conditional_branch` after extraction/validation.
2. Send high-risk path to `manual_approval`.
3. Send low-risk path to `parallel_execute` for fast fan-out sync.
4. For batches, insert `loop_iterate` before submit to process each item.

Selector reliability tips:
- Fill `selector`, `textHint`, `testId`, and `ariaLabel` in Playwright nodes when possible.
- Keep `SELECTOR_AI_ENABLED=1` for automatic fallback suggestions.

## 12. Collaborate in real time

When multiple users are signed in:
- Presence is shown in the sidebar (`viewing`/`editing` + selected node)
- Add workflow comments (optionally tied to selected node)
- Review attributed change history (who changed what and when)

Live collaboration uses WebSocket presence on:
- `/ws?type=collab&workflowId=<id>&token=<jwt>`

## 13. Configure integrations and CSV imports

Use the `Integrations` section in the sidebar to:
1. Create connector profiles (`http_api`, `postgresql`, `mysql`, `mongodb`, `google_sheets`, `airtable`, `s3`)
2. Test connectivity
3. Delete old connectors

Use `Parse CSV + Add Node` to:
- Parse inline CSV text or a file path
- Automatically add a `data_import_csv` node to your workflow

For API-style connectors, use `integration_request` node fields:
- `integrationId`
- `path` (or full `url` override)
- `method`
- `saveAs`

## 14. Visual regression and deep debugging

Visual regression:
1. Add `playwright_visual_assert` node.
2. Set `baselineName` and optional `selector`.
3. Run once with `autoCreateBaseline=true` to capture baseline.
4. Run again to compare using `thresholdPct`.

Debugging tools now available in `Run Diagnostics`:
- Failed-node summary and retry information
- Variable inspector (context snapshot)
- Network inspector (`http_request`/`integration_request` logs)
- Screenshot, DOM snapshot, and visual artifact galleries

## 15. Enable two-factor authentication (TOTP)

Per-user 2FA flow in sidebar `Security` section:
1. Click `Start 2FA Setup`.
2. Scan QR code in authenticator app (or use manual secret).
3. Enter current 6-digit token.
4. Click `Verify 2FA Setup`.

After enablement:
- Login requires username + password + TOTP code.
- Disable requires current valid TOTP code.

Related API endpoints:
- `GET /api/auth/2fa/status`
- `POST /api/auth/2fa/setup`
- `POST /api/auth/2fa/verify-setup`
- `POST /api/auth/2fa/disable`

## 16. Secrets and LLM transforms

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

## 17. Admin features

For admin users:
- Manage users (create/disable/delete)
- Update role permissions
- Manage webhook subscriptions
- Review audit log events in the sidebar (`Audit Log`)

Common webhook events:
- `run.started`
- `run.succeeded`
- `run.failed`
- `run.waiting_approval`

Audit API example:
```bash
curl -sS "http://localhost:8080/api/admin/audit?limit=20" \
  -H "Authorization: Bearer <token>"
```

## 18. Useful commands

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

Check Prometheus metrics output:

```bash
curl -sS http://localhost:8080/metrics | head -n 40
```

Stop all services:

```bash
docker compose down
```

Rebuild clean container node modules (fix module errors):

```bash
docker compose up --build --renew-anon-volumes
```

## 19. Troubleshooting

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

Need less verbose request logs:
- Set `REQUEST_LOGS=0` in `.env` and restart.
