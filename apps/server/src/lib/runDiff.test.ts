import test from "node:test";
import assert from "node:assert/strict";
import { diffRunNodeStates } from "./runDiff.js";

test("diffRunNodeStates returns no baseline when previous success is missing", () => {
  const result = diffRunNodeStates({ id: "run-1", nodeStates: {} }, null);
  assert.equal(result.hasBaseline, false);
  assert.deepEqual(result.changes, []);
});

test("diffRunNodeStates reports changed statuses and durations", () => {
  const result = diffRunNodeStates(
    {
      id: "run-2",
      nodeStates: {
        a: { status: "succeeded", durationMs: 100 },
        b: { status: "failed", durationMs: 200 }
      }
    },
    {
      id: "run-1",
      nodeStates: {
        a: { status: "succeeded", durationMs: 95 },
        b: { status: "succeeded", durationMs: 200 }
      }
    }
  );

  assert.equal(result.hasBaseline, true);
  assert.equal(result.baselineRunId, "run-1");
  assert.equal(result.changes.length, 2);
  assert.equal(result.changes.some((row) => row.nodeId === "a" && row.durationNow === 100), true);
  assert.equal(result.changes.some((row) => row.nodeId === "b" && row.statusNow === "failed"), true);
});
