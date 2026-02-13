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
4. Review generated nodes and adjust selectors/keys in `Inspector`.
5. Click `Test Run` and inspect `Run Diagnostics`.

Expected outcome:
- A draft workflow is created.
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

## Demo Assets
- Template source: `apps/server/src/lib/templates.ts`
- Node catalog: `apps/web/src/lib/nodeCatalog.ts`
- Activity catalog: `apps/server/src/lib/activities.ts`

## Suggested Demo Script Length
- Demo 1: 5-7 minutes
- Demo 2: 4-6 minutes
- Demo 3: 4-5 minutes

Total: 15-18 minutes for a full product walkthrough.
