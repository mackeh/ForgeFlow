# ForgeFlow Quick Start Manual

This guide gets you from zero to a working automation quickly.

## 1. Start the app

From the project root:

```bash
./start.sh
```

What this does:
- Creates `.env` from `.env.example` (if missing)
- Auto-updates images/dependencies (unless `AUTO_UPDATE=0`)
- Runs DB migration
- Starts all services

Open the UI:
- `http://localhost:5173`

## 2. Login

Use values from `.env`:
- `APP_USERNAME`
- `APP_PASSWORD`

Default values (if unchanged):
- Username: `local`
- Password: `localpass`

## 3. Create your first workflow

1. Click `New` in the left sidebar.
2. Add nodes from the top toolbar (`+ HTTP Request`, `+ Web Navigate`, etc.).
3. Select a node and edit JSON in the right `Inspector`.
4. Click `Save Draft`.

### Recommended first node chain

1. `start`
2. `playwright_navigate`
3. `playwright_fill`
4. `playwright_click`
5. `playwright_extract`
6. `submit_guard`

## 4. Record actions

### Web recorder
1. Click `Record Web`.
2. Perform actions in the opened browser.
3. Recorded click/fill nodes are added to the graph.

### Desktop recorder
1. Click `Record Desktop`.
2. Perform desktop actions.
3. Click `Stop Desktop`.
4. Recorded desktop nodes are added (with image targets and confidence).

Linux note for desktop automation:
- Run `xhost +local:`
- Ensure `DISPLAY` is set in `.env` (usually `:0`)

## 5. Test and publish

1. Click `Save Draft`.
2. Click `Test Run` to run draft definition.
3. Click `Publish` when stable.
4. Click `Run` for production run (published definition).

## 6. Use secrets safely

In the left panel (`Secrets`):
1. Enter secret key/value.
2. Click `Save Secret`.

Use secrets in node fields with:
- `{{secret:MY_KEY}}`

Example:
- API header value: `Bearer {{secret:CRM_TOKEN}}`

## 7. Handle approvals and failures

- If a `manual_approval` node pauses execution, run status becomes `WAITING_APPROVAL`.
- In run timeline, click `Approve Waiting Node` to continue.
- If run fails, click `Resume From Failed Run` to continue from checkpoint.
- Use `Diff vs Last Success` to compare behavior changes.

## 8. Node types you should use often

- `validate_record`: required fields and regex checks
- `submit_guard`: JSON schema check before submit
- `transform_llm`: cleanup/normalize data via local Ollama model
- `manual_approval`: stop and require user approval before critical actions

## 9. Local LLM setup

Pull a model (once):

```bash
docker exec -it rpa-ollama ollama pull llama3.2
```

## 10. Useful maintenance commands

Rebuild and start:

```bash
./start.sh
```

Start without auto-update:

```bash
AUTO_UPDATE=0 ./start.sh
```

Stop all services:

```bash
docker compose down
```

View logs:

```bash
docker compose logs -f
```

## 11. Common troubleshooting

### Port conflict
- Run `docker compose down` and retry.
- If conflict persists, check other running services on same ports.

### Login fails
- Check `.env` values for `APP_USERNAME` and `APP_PASSWORD`.
- If using `APP_PASSWORD_HASH_ARGON2`, use the original plaintext password.

### Desktop nodes fail to find targets
- Lower/adjust `confidence` in node data.
- Re-record click images if screen/theme/layout changed.

### LLM transform fails
- Ensure Ollama container is up.
- Ensure the selected model is pulled (see section 9).
