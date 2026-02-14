# First Automation in 10 Minutes

This tutorial gets a new contributor from zero to a successful test run using a starter workflow.

## 1. Start the stack (1 minute)

```bash
./start.sh
```

Open:
- UI: `http://localhost:5173`
- API health: `http://localhost:8080/ready`

Login with local defaults:
- Username: `local`
- Password: `localpass`

## 2. Import the starter workflow (2 minutes)

1. In the left sidebar, click `Load Workflow File`.
2. Select `docs/examples/workflows/first-automation.workflow.json`.
3. Confirm the workflow appears in the canvas.

What this starter does:
- sets `orderId`
- sets `orderStatus`
- validates `orderStatus` with `submit_guard`

## 3. Run in test mode (2 minutes)

1. Click `Test Run` in the top toolbar.
2. Open the newest run in `Run Timeline`.
3. In `Run Diagnostics`, confirm status is `SUCCEEDED`.

Expected result:
- All nodes succeed.
- No approval pause is required.

## 4. Verify output context (2 minutes)

In `Run Diagnostics` -> `Variable Inspector`, confirm values:
- `orderId`: `PO-1001`
- `orderStatus`: `approved`

If `submit_guard` fails, check the schema in the node inspector and rerun.

## 5. Make one intentional change (2 minutes)

1. Edit `Set Order Status` value from `approved` to `rejected`.
2. Run `Test Run` again.
3. Confirm the run still passes.

Now set it to `pending` and rerun. The run should fail at `Validate Order Status`.

## 6. Save and document (1 minute)

1. Click `Save Draft`.
2. Add a short note to your PR describing:
- what you changed
- why the guard passed/failed in each run

## Troubleshooting

- Recorder/browser dependencies are not required for this tutorial.
- If login fails, verify `.env` credentials and restart with `./start.sh`.
- If run fails before node execution, check preflight messages in the UI status area.
