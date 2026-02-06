import test from "node:test";
import assert from "node:assert/strict";
import { startRun } from "./runner.js";
import { createInMemoryRunnerPrisma } from "./testHarness.js";

function workflowDefinition(nodes: any[], edges: any[]) {
  return {
    nodes,
    edges,
    execution: {
      globalTimeoutMs: 60_000,
      defaultRetries: 0,
      defaultNodeTimeoutMs: 3_000
    }
  };
}

function baseWorkflow(overrides: Record<string, unknown>) {
  return {
    id: "wf-1",
    name: "Workflow",
    definition: null,
    draftDefinition: null,
    publishedDefinition: null,
    publishedVersion: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides
  };
}

function baseRun(overrides: Record<string, unknown>) {
  return {
    id: "run-1",
    workflowId: "wf-1",
    workflowVersion: null,
    testMode: true,
    status: "PENDING",
    logs: [],
    nodeStates: {},
    context: {},
    checkpointNodeId: null,
    artifacts: [],
    inputData: {},
    resumeFromRunId: null,
    startedAt: null,
    finishedAt: null,
    createdAt: new Date().toISOString(),
    ...overrides
  };
}

test("full workflow execution in test mode succeeds", async () => {
  const definition = workflowDefinition(
    [
      { id: "start", data: { type: "start", label: "Start" } },
      { id: "set-value", data: { type: "set_variable", label: "Set Value", key: "result", value: "ok" } }
    ],
    [{ id: "e-start-set", source: "start", target: "set-value" }]
  );

  const harness = createInMemoryRunnerPrisma({
    workflow: baseWorkflow({ draftDefinition: definition, definition }),
    run: baseRun({ testMode: true })
  });

  await startRun(harness.prisma, "run-1");
  const finished = harness.getRun("run-1");

  assert.equal(finished?.status, "SUCCEEDED");
  assert.equal(finished?.context?.result, "ok");
  assert.equal(finished?.nodeStates?.["set-value"]?.status, "succeeded");
});

test("production run uses published definition", async () => {
  const draft = workflowDefinition(
    [
      { id: "start", data: { type: "start", label: "Start" } },
      { id: "set-draft", data: { type: "set_variable", key: "env", value: "draft" } }
    ],
    [{ id: "e-start-draft", source: "start", target: "set-draft" }]
  );
  const published = workflowDefinition(
    [
      { id: "start", data: { type: "start", label: "Start" } },
      { id: "set-prod", data: { type: "set_variable", key: "env", value: "published" } }
    ],
    [{ id: "e-start-prod", source: "start", target: "set-prod" }]
  );

  const harness = createInMemoryRunnerPrisma({
    workflow: baseWorkflow({ draftDefinition: draft, definition: draft, publishedDefinition: published, publishedVersion: 2 }),
    run: baseRun({ testMode: false })
  });

  await startRun(harness.prisma, "run-1");
  const finished = harness.getRun("run-1");

  assert.equal(finished?.status, "SUCCEEDED");
  assert.equal(finished?.context?.env, "published");
  assert.equal(Boolean(finished?.nodeStates?.["set-prod"]), true);
  assert.equal(Boolean(finished?.nodeStates?.["set-draft"]), false);
});

test("manual approval run pauses then succeeds after approval", async () => {
  const definition = workflowDefinition(
    [
      { id: "start", data: { type: "start", label: "Start" } },
      { id: "approve-1", data: { type: "manual_approval", message: "Approve me" } }
    ],
    [{ id: "e-start-approve", source: "start", target: "approve-1" }]
  );

  const harness = createInMemoryRunnerPrisma({
    workflow: baseWorkflow({ draftDefinition: definition, definition }),
    run: baseRun({ testMode: false })
  });

  await startRun(harness.prisma, "run-1");
  const waiting = harness.getRun("run-1");
  assert.equal(waiting?.status, "WAITING_APPROVAL");
  assert.equal(waiting?.logs?.some((entry: any) => entry.status === "waiting_approval"), true);

  harness.updateRun("run-1", {
    status: "PENDING",
    context: {
      ...(waiting?.context || {}),
      __approvals: {
        ...((waiting?.context || {}).__approvals || {}),
        "approve-1": true
      }
    }
  });

  await startRun(harness.prisma, "run-1");
  const finished = harness.getRun("run-1");
  assert.equal(finished?.status, "SUCCEEDED");
  assert.equal(finished?.nodeStates?.["approve-1"]?.status, "succeeded");
});

test("resume from failed run executes only previously failed nodes", async () => {
  const originalFetch = global.fetch;
  let callCount = 0;

  global.fetch = (async () => {
    callCount += 1;
    if (callCount === 1) {
      return {
        ok: false,
        status: 500,
        headers: { get: () => "application/json" },
        json: async () => ({ error: "temporary failure" }),
        text: async () => "temporary failure"
      } as any;
    }
    return {
      ok: true,
      status: 200,
      headers: { get: () => "application/json" },
      json: async () => ({ ok: true }),
      text: async () => '{"ok":true}'
    } as any;
  }) as any;

  try {
    const definition = workflowDefinition(
      [
        { id: "start", data: { type: "start", label: "Start" } },
        { id: "set-token", data: { type: "set_variable", key: "token", value: "abc-123" } },
        { id: "call-api", data: { type: "http_request", url: "https://example.test/api", method: "GET", saveAs: "api" } }
      ],
      [
        { id: "e-start-token", source: "start", target: "set-token" },
        { id: "e-token-api", source: "set-token", target: "call-api" }
      ]
    );

    const firstRunHarness = createInMemoryRunnerPrisma({
      workflow: baseWorkflow({ draftDefinition: definition, definition }),
      run: baseRun({ id: "run-1", testMode: true, logs: [] })
    });

    await startRun(firstRunHarness.prisma, "run-1");
    const firstRun = firstRunHarness.getRun("run-1");
    assert.equal(firstRun?.status, "FAILED");
    assert.equal(firstRun?.nodeStates?.["set-token"]?.status, "succeeded");
    assert.equal(firstRun?.nodeStates?.["call-api"]?.status, "failed");

    const resumedNodeStates = {
      ...(firstRun?.nodeStates || {}),
      "call-api": {
        ...(firstRun?.nodeStates?.["call-api"] || {}),
        status: "queued",
        attempts: 0,
        error: undefined
      }
    };

    const secondRunHarness = createInMemoryRunnerPrisma({
      workflow: baseWorkflow({ draftDefinition: definition, definition }),
      run: baseRun({
        id: "run-2",
        testMode: true,
        nodeStates: resumedNodeStates,
        context: firstRun?.context || {},
        logs: firstRun?.logs || [],
        resumeFromRunId: "run-1"
      })
    });

    const setTokenStartsBefore = (firstRun?.logs || []).filter(
      (entry: any) => entry.nodeId === "set-token" && entry.status === "start"
    ).length;

    await startRun(secondRunHarness.prisma, "run-2");
    const secondRun = secondRunHarness.getRun("run-2");
    assert.equal(secondRun?.status, "SUCCEEDED");
    assert.equal(secondRun?.context?.token, "abc-123");
    assert.equal(secondRun?.nodeStates?.["call-api"]?.status, "succeeded");

    const setTokenStartsAfter = (secondRun?.logs || []).filter(
      (entry: any) => entry.nodeId === "set-token" && entry.status === "start"
    ).length;
    assert.equal(setTokenStartsAfter, setTokenStartsBefore);
  } finally {
    global.fetch = originalFetch;
  }
});

test("transform_llm node uses deterministic fallback when model output is invalid JSON", async () => {
  const originalFetch = global.fetch;
  global.fetch = (async (url: string) => {
    if (!String(url).includes("/api/generate")) {
      throw new Error(`Unexpected URL in LLM test: ${url}`);
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({ response: "This is not valid JSON output." })
    } as any;
  }) as any;

  try {
    const definition = workflowDefinition(
      [
        { id: "start", data: { type: "start", label: "Start" } },
        {
          id: "llm-clean",
          data: {
            type: "transform_llm",
            inputKey: "raw",
            outputKey: "clean",
            strictJson: true,
            fallbackMode: "pick_object",
            outputSchema: {
              type: "object",
              additionalProperties: false,
              required: ["name"],
              properties: {
                name: { type: "string" }
              }
            }
          }
        }
      ],
      [{ id: "e-start-llm", source: "start", target: "llm-clean" }]
    );

    const harness = createInMemoryRunnerPrisma({
      workflow: baseWorkflow({ draftDefinition: definition, definition }),
      run: baseRun({
        id: "run-llm",
        testMode: true,
        inputData: { raw: { name: "Alice", ignored: "x" } }
      })
    });

    await startRun(harness.prisma, "run-llm");
    const finished = harness.getRun("run-llm");

    assert.equal(finished?.status, "SUCCEEDED");
    assert.deepEqual(finished?.context?.clean, { name: "Alice" });
    assert.equal(finished?.nodeStates?.["llm-clean"]?.status, "succeeded");
  } finally {
    global.fetch = originalFetch;
  }
});

test("parallel_execute runs independent tasks concurrently and stores summary output", async () => {
  const definition = workflowDefinition(
    [
      { id: "start", data: { type: "start", label: "Start" } },
      {
        id: "parallel",
        data: {
          type: "parallel_execute",
          outputKey: "parallelSummary",
          tasks: [
            { id: "set-a", type: "set_variable", key: "alpha", value: "A" },
            { id: "set-b", type: "set_variable", key: "beta", value: "B" }
          ]
        }
      }
    ],
    [{ id: "e-start-parallel", source: "start", target: "parallel" }]
  );

  const harness = createInMemoryRunnerPrisma({
    workflow: baseWorkflow({ draftDefinition: definition, definition }),
    run: baseRun({ id: "run-parallel", testMode: true })
  });

  await startRun(harness.prisma, "run-parallel");
  const finished = harness.getRun("run-parallel");

  assert.equal(finished?.status, "SUCCEEDED");
  assert.equal(finished?.context?.alpha, "A");
  assert.equal(finished?.context?.beta, "B");
  assert.equal(Array.isArray(finished?.context?.parallelSummary), true);
  assert.equal(finished?.context?.parallelSummary?.length, 2);
});

test("parallel_execute fails run when any task fails and allowPartial is false", async () => {
  const definition = workflowDefinition(
    [
      { id: "start", data: { type: "start", label: "Start" } },
      {
        id: "parallel",
        data: {
          type: "parallel_execute",
          outputKey: "parallelSummary",
          tasks: [{ id: "bad-set", type: "set_variable", value: "missing key" }]
        }
      }
    ],
    [{ id: "e-start-parallel", source: "start", target: "parallel" }]
  );

  const harness = createInMemoryRunnerPrisma({
    workflow: baseWorkflow({ draftDefinition: definition, definition }),
    run: baseRun({ id: "run-parallel-fail", testMode: true })
  });

  await startRun(harness.prisma, "run-parallel-fail");
  const finished = harness.getRun("run-parallel-fail");

  assert.equal(finished?.status, "FAILED");
  assert.equal(finished?.nodeStates?.parallel?.status, "failed");
  assert.equal(String(finished?.nodeStates?.parallel?.error || "").includes("parallel_execute failed"), true);
});
