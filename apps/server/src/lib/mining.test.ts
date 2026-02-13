import test from "node:test";
import assert from "node:assert/strict";
import { buildMiningSummary } from "./mining.js";

test("buildMiningSummary computes bottlenecks, variants, and opportunities", () => {
  const now = new Date("2026-02-13T10:00:00.000Z");
  const runs = [
    {
      id: "r1",
      status: "FAILED",
      workflowId: "wf-a",
      workflow: { id: "wf-a", name: "Alpha" },
      createdAt: "2026-02-13T09:00:00.000Z",
      logs: [
        { nodeId: "start", status: "start" },
        { nodeId: "extract", status: "start" },
        { nodeId: "approve", status: "waiting_approval" }
      ],
      nodeStates: {
        extract: { status: "failed", durationMs: 4200 },
        approve: { status: "queued", durationMs: 0 }
      }
    },
    {
      id: "r2",
      status: "SUCCEEDED",
      workflowId: "wf-a",
      workflow: { id: "wf-a", name: "Alpha" },
      createdAt: "2026-02-13T08:00:00.000Z",
      logs: [
        { nodeId: "start", status: "start" },
        { nodeId: "extract", status: "start" }
      ],
      nodeStates: {
        extract: { status: "succeeded", durationMs: 1900 }
      }
    }
  ];

  const audits = [
    { at: "2026-02-13T09:10:00.000Z", actorUsername: "sam", action: "run.start", resourceType: "run", success: true },
    { at: "2026-02-13T09:11:00.000Z", actorUsername: "sam", action: "run.start", resourceType: "run", success: true }
  ];

  const summary = buildMiningSummary(runs as any, audits as any, { days: 7, referenceNow: now });
  assert.equal(summary.summary.totalRuns, 2);
  assert.equal(summary.bottlenecks[0].nodeId, "extract");
  assert.equal(summary.processVariants.length > 0, true);
  assert.equal(summary.opportunities[0].workflowId, "wf-a");
  assert.equal(summary.topHumanActions[0].key, "run:run.start");
});
