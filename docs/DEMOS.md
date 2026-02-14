# ForgeFlow Demo Guide

Use these demos during onboarding, stakeholder reviews, and release validation.

## Demo 1: Autopilot Invoice Triage
Goal: Generate a working workflow from plain language.

1. Open `Autopilot` in the left sidebar.
2. Prompt example:
```text
Open vendor portal, extract invoice rows, normalize fields with AI, post to API, require manager approval over $1000.
```
3. Click `Generate with Autopilot`.
4. Review confidence score, node-level suggestions, and warnings in the Autopilot plan panel.
5. Click `Create Draft Workflow` to confirm.
6. Adjust selectors/keys in `Inspector`.
7. Click `Test Run` and inspect `Run Diagnostics`.

Expected outcome:
- A reviewed draft workflow is created only after explicit confirmation.
- AI/data nodes are prewired with context keys.
- Run timeline and logs update without manual node creation.

## Demo 2: Orchestrator Unattended Queue
Goal: Show centralized robot/job management and dispatch.

1. Open `Orchestrator` in sidebar.
2. Create an unattended robot.
3. Queue a job for the selected workflow (`test mode` on).
4. Click `Dispatch` on queued job.
5. Click `Sync` to update job status from run state.

Expected outcome:
- Job transitions: `queued -> dispatched -> completed/failed`.
- A linked run appears in run timeline.
- Orchestrator overview counters update.

## Demo 3: Document Understanding and Clipboard AI
Goal: Demonstrate AI-assisted extraction and transfer.

1. Add `document_understanding` node.
2. Set `inputKey` (raw text) and `outputKey` (parsed payload).
3. Add `clipboard_ai_transfer` node.
4. Set `sourceKey` and `targetKey`, enable `aiNormalize`.
5. Run in test mode with sample document text in run input.

Expected outcome:
- Structured fields are extracted from plain text.
- Normalized data is copied to target key.
- Context inspector shows extracted + transferred values.

## Demo 4: Workflow Builder MVP Controls
Goal: Validate the core drag-and-drop builder flow and persistence.

1. Create/select a workflow and add 3+ nodes from quick-add.
2. Connect nodes on canvas using edge handles.
3. Select an edge and remove it (`Delete` or `More > Disconnect Edge`).
4. Move or delete a node, then run `Undo` and `Redo`.
5. Export with `Save Workflow File`, then import with `Load Workflow File`.

Expected outcome:
- Editor supports incremental design changes with reversible history.
- Edge disconnect works without deleting nodes.
- Exported files include workflow schema metadata and can be re-imported.

## Demo 5: Recorder Draft Review and Insert
Goal: Capture browser actions, refine them, and insert a clean sequence.

1. Click `Record Web` and optionally set a start URL in the recorder panel.
2. Perform actions in the recorder browser (navigate, click, fill).
3. Click `Stop Web` and review captured events.
4. Reorder events, edit selectors/values, and mark noisy events as `Skip`.
5. Click `Insert Sequence`, then run `Test Run`.

Expected outcome:
- Recorder events are captured as an editable draft before touching the canvas.
- Inserted nodes are linked in sequence with stable defaults.
- The resulting flow is cleaner than raw event capture.

## Demo 6: Real-World Starter Pack
Goal: Prove production-leaning workflows can be launched in minutes.

1. Open `Templates` and create workflows from:
   - `Invoice Intake + Approval`
   - `Web Scrape -> API Sync`
   - `CSV Cleanup + Validation`
   - `Email Triage -> Ticket Create`
   - `Scheduled Health Check + Alert`
2. For each workflow, set integration URLs/credentials in inspector inputs.
3. Run each in `Test Run` mode with representative sample payloads.
4. Inspect branch behavior (approval paths, validation failures, degraded service alerts).

Expected outcome:
- Teams can start from realistic baseline flows rather than empty canvas.
- Key automation patterns (ingest, transform, branch, sync, alert) are prewired.
- Contributors can extend templates without changing core runtime behavior.

## Demo 7: Setup Wizard + Starter Walkthrough
Goal: Show first-time user guidance from template selection to run readiness.

1. Open `Templates` and select any starter template.
2. Complete required fields in `Template Setup Wizard`.
3. Click `Validate Setup` and confirm checks show `PASS`.
4. Click `Copy Sample Input` and inspect JSON payload.
5. Start `Starter Walkthrough` and progress through all steps.
6. Create workflow and inspect key nodes to confirm setup values were injected.

Expected outcome:
- Setup friction is reduced with explicit required fields/checks.
- Users can verify run readiness before creating workflow.
- New users get an in-product path for template -> test -> publish.

## Demo Assets
- Template source: `apps/server/src/lib/templates.ts`
- Node catalog: `apps/web/src/lib/nodeCatalog.ts`
- Activity catalog: `apps/server/src/lib/activities.ts`

## Suggested Demo Script Length
- Demo 1: 5-7 minutes
- Demo 2: 4-6 minutes
- Demo 3: 4-5 minutes
- Demo 4: 4-6 minutes
- Demo 5: 4-6 minutes
- Demo 6: 8-10 minutes
- Demo 7: 4-5 minutes

Total: 35-45 minutes for a full product walkthrough.
