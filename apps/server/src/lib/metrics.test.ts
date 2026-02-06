import test from "node:test";
import assert from "node:assert/strict";
import { buildDashboardMetrics } from "./metrics.js";

test("buildDashboardMetrics computes summary, daily and top failures", () => {
  const now = new Date("2026-02-06T10:00:00.000Z");
  const runs = [
    {
      id: "r1",
      status: "SUCCEEDED",
      workflowId: "wf-a",
      workflow: { id: "wf-a", name: "Alpha" },
      createdAt: new Date(now.getTime() - 60 * 60 * 1000),
      startedAt: new Date(now.getTime() - 60 * 60 * 1000),
      finishedAt: new Date(now.getTime() - 59 * 60 * 1000),
      logs: []
    },
    {
      id: "r2",
      status: "FAILED",
      workflowId: "wf-a",
      workflow: { id: "wf-a", name: "Alpha" },
      createdAt: new Date(now.getTime() - 30 * 60 * 1000),
      startedAt: new Date(now.getTime() - 30 * 60 * 1000),
      finishedAt: new Date(now.getTime() - 29 * 60 * 1000),
      logs: [{ nodeId: "submit", status: "failed" }]
    },
    {
      id: "r3",
      status: "WAITING_APPROVAL",
      workflowId: "wf-b",
      workflow: { id: "wf-b", name: "Beta" },
      createdAt: new Date(now.getTime() - 10 * 60 * 1000),
      logs: [{ nodeId: "approve", status: "waiting_approval" }]
    }
  ];

  const metrics = buildDashboardMetrics(runs as any, "UTC", 2);
  assert.equal(metrics.summary.totalRuns, 3);
  assert.equal(metrics.summary.succeeded, 1);
  assert.equal(metrics.summary.failed, 1);
  assert.equal(metrics.summary.waiting, 1);
  assert.equal(metrics.summary.successRate, 33.3);
  assert.equal(metrics.topFailures[0].nodeId, "submit");
  assert.equal(metrics.topWorkflows[0].workflowName, "Alpha");
  assert.equal(metrics.topWorkflows[0].failed, 1);
  assert.equal(metrics.daily.length >= 1, true);
});
