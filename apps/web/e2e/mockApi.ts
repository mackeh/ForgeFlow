import type { Page, Route } from "@playwright/test";

type WorkflowRecord = {
  id: string;
  name: string;
  publishedVersion: number | null;
  createdAt: string;
  updatedAt: string;
  definition: Record<string, unknown>;
  draftDefinition: Record<string, unknown>;
  publishedDefinition: Record<string, unknown> | null;
};

type RunRecord = {
  id: string;
  workflowId: string;
  workflowVersion: number | null;
  testMode: boolean;
  status: string;
  checkpointNodeId: string | null;
  resumeFromRunId: string | null;
  startedAt: string;
  finishedAt: string;
  createdAt: string;
  logs: unknown[];
  nodeStates: Record<string, unknown>;
  context: Record<string, unknown>;
  artifacts: unknown[];
  inputData: unknown;
};

type OrchestratorRobot = {
  id: string;
  name: string;
  mode: "attended" | "unattended";
  enabled: boolean;
  labels: string[];
  maxConcurrentJobs: number;
  createdAt: string;
  updatedAt: string;
  lastHeartbeatAt?: string;
};

type OrchestratorJob = {
  id: string;
  workflowId: string;
  mode: "attended" | "unattended";
  status: "queued" | "dispatched" | "completed" | "failed" | "cancelled";
  robotId?: string;
  runId?: string;
  runStatus?: string | null;
  testMode: boolean;
  inputData?: unknown;
  error?: string;
  createdAt: string;
  updatedAt: string;
};

function nowIso() {
  return new Date().toISOString();
}

function defaultDefinition() {
  return {
    nodes: [
      {
        id: "start",
        type: "action",
        position: { x: 80, y: 80 },
        data: { label: "Start", type: "start" }
      }
    ],
    edges: []
  };
}

function json(route: Route, payload: unknown, status = 200) {
  return route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(payload)
  });
}

function parseBody(route: Route) {
  const raw = route.request().postData();
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function createState() {
  const definition = defaultDefinition();
  const createdAt = nowIso();
  const workflow: WorkflowRecord = {
    id: "wf-1",
    name: "Demo Workflow",
    publishedVersion: 1,
    createdAt,
    updatedAt: createdAt,
    definition,
    draftDefinition: definition,
    publishedDefinition: definition
  };

  return {
    user: { username: "local", role: "admin", permissions: ["*"] },
    workflows: [workflow] as WorkflowRecord[],
    runs: [] as RunRecord[],
    versions: {
      "wf-1": [
        {
          id: "wfv-1",
          version: 1,
          status: "published",
          notes: "Initial",
          createdAt
        }
      ]
    } as Record<string, Array<Record<string, unknown>>>,
    secrets: [] as Array<{ key: string; updatedAt: string }>,
    integrations: [] as Array<Record<string, unknown>>,
    schedules: [] as Array<Record<string, unknown>>,
    robots: [] as OrchestratorRobot[],
    jobs: [] as OrchestratorJob[],
    counters: {
      workflow: 1,
      run: 0,
      version: 1,
      robot: 0,
      job: 0
    }
  };
}

function buildDashboard(state: ReturnType<typeof createState>) {
  const totalRuns = state.runs.length;
  const succeeded = state.runs.filter((run) => run.status === "SUCCEEDED").length;
  const failed = state.runs.filter((run) => run.status === "FAILED").length;
  const successRate = totalRuns ? Math.round((succeeded / totalRuns) * 100) : 0;
  return {
    summary: {
      totalRuns,
      succeeded,
      failed,
      running: state.runs.filter((run) => run.status === "RUNNING").length,
      successRate,
      avgDurationMs: 320
    },
    daily: [{ date: nowIso().slice(0, 10), total: totalRuns, succeeded, failed }],
    hourly: Array.from({ length: 24 }, (_, hour) => ({ hour: String(hour).padStart(2, "0"), total: hour % 6 === 0 ? 1 : 0 })),
    topFailures: [],
    topWorkflows: state.workflows.map((workflow) => ({
      workflowId: workflow.id,
      workflowName: workflow.name,
      failed: failed > 0 ? 1 : 0,
      successRate
    })),
    schedules: {
      total: state.schedules.length,
      active: state.schedules.filter((item) => item.enabled !== false).length,
      disabled: state.schedules.filter((item) => item.enabled === false).length
    },
    resources: {
      activeRuns: 0,
      uptimeSec: 100,
      rssBytes: 120000000,
      heapUsedBytes: 40000000,
      heapTotalBytes: 65000000,
      externalBytes: 10000000,
      loadAverage1m: 0.12,
      loadAverage5m: 0.2,
      loadAverage15m: 0.22
    }
  };
}

function orchestratorOverview(state: ReturnType<typeof createState>) {
  const byStatus = state.jobs.reduce<Record<string, number>>((acc, job) => {
    acc[job.status] = (acc[job.status] || 0) + 1;
    return acc;
  }, {});
  return {
    robotCount: state.robots.length,
    enabledRobots: state.robots.filter((robot) => robot.enabled).length,
    queuedJobs: state.jobs.filter((job) => job.status === "queued").length,
    dispatchedJobs: state.jobs.filter((job) => job.status === "dispatched").length,
    byStatus
  };
}

export async function installMockApi(page: Page) {
  const state = createState();

  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const method = request.method();
    const url = new URL(request.url());
    const path = url.pathname;
    const body = parseBody(route);

    if (path === "/api/auth/login" && method === "POST") {
      return json(route, { token: "e2e-token", user: state.user });
    }
    if (path === "/api/auth/me" && method === "GET") return json(route, state.user);
    if (path === "/api/auth/2fa/status" && method === "GET") return json(route, { enabled: false, pending: false });
    if (path === "/api/auth/2fa/setup" && method === "POST") return json(route, { secret: "secret", otpauthUrl: "otpauth://demo", qrCodeUrl: "" });
    if (path === "/api/auth/2fa/verify-setup" && method === "POST") return json(route, { ok: true, user: state.user });
    if (path === "/api/auth/2fa/disable" && method === "POST") return json(route, { ok: true, user: state.user });

    if (path === "/api/templates" && method === "GET") {
      return json(route, [
        {
          id: "template-demo",
          name: "Demo Template",
          category: "General",
          difficulty: "starter",
          nodes: 3,
          description: "Demo template",
          useCase: "Smoke",
          tags: ["demo"],
          setup: {
            requiredInputs: [{ id: "api_url", label: "API URL", kind: "url", required: true, defaultValue: "https://example.com" }],
            connectionChecks: [{ id: "preflight", label: "Template preflight readiness", type: "preflight" }],
            sampleInput: { source: "smoke" },
            runbook: ["Run in test mode first"]
          }
        }
      ]);
    }
    if (path === "/api/templates/template-demo" && method === "GET") {
      return json(route, {
        id: "template-demo",
        name: "Demo Template",
        category: "General",
        difficulty: "starter",
        nodes: 3,
        description: "Demo template",
        useCase: "Smoke",
        tags: ["demo"],
        setup: {
          requiredInputs: [{ id: "api_url", label: "API URL", kind: "url", required: true, defaultValue: "https://example.com" }],
          connectionChecks: [{ id: "preflight", label: "Template preflight readiness", type: "preflight" }],
          sampleInput: { source: "smoke" },
          runbook: ["Run in test mode first"]
        },
        definition: defaultDefinition()
      });
    }
    if (path === "/api/activities" && method === "GET") {
      return json(route, {
        targetLibrarySize: 300,
        currentTotal: 30,
        availableCount: 20,
        plannedCount: 10,
        byCategory: { Core: 8, Web: 6, AI: 4, Data: 6, Control: 6 },
        byPhase: { "phase-1": 20, "phase-2": 10, "phase-3": 0 },
        roadmap: [
          { id: "system-core", label: "System & Core", phase: "phase-1", total: 10, available: 6, planned: 4, activityIds: [] }
        ],
        phaseFocus: { now: "phase-1", next: "phase-2", later: "phase-3" },
        items: []
      });
    }
    if (path === "/api/autopilot/plan" && method === "POST") {
      return json(route, {
        name: String(body.name || "Autopilot Workflow"),
        description: "Autopilot mock plan",
        capabilities: ["web", "ai"],
        warnings: [],
        definition: defaultDefinition()
      });
    }
    if (path === "/api/document/understand" && method === "POST") {
      return json(route, {
        rawText: String(body.text || ""),
        fields: { invoice_number: "INV-1", total_amount: "$42.00" },
        entities: [{ key: "invoice_number", value: "INV-1" }],
        confidence: 0.91
      });
    }

    if (path === "/api/workflows" && method === "GET") {
      const summaries = state.workflows.map((workflow) => ({
        id: workflow.id,
        name: workflow.name,
        publishedVersion: workflow.publishedVersion,
        createdAt: workflow.createdAt,
        updatedAt: workflow.updatedAt
      }));
      return json(route, summaries);
    }
    if (path === "/api/workflows" && method === "POST") {
      state.counters.workflow += 1;
      const id = `wf-${state.counters.workflow}`;
      const createdAt = nowIso();
      const definition = (body.definition as Record<string, unknown>) || defaultDefinition();
      const record: WorkflowRecord = {
        id,
        name: String(body.name || `Workflow ${state.counters.workflow}`),
        publishedVersion: null,
        createdAt,
        updatedAt: createdAt,
        definition,
        draftDefinition: definition,
        publishedDefinition: null
      };
      state.workflows.unshift(record);
      state.versions[id] = [];
      return json(route, record);
    }

    const workflowVersionsMatch = path.match(/^\/api\/workflows\/([^/]+)\/versions$/);
    if (workflowVersionsMatch && method === "GET") return json(route, state.versions[workflowVersionsMatch[1]] || []);

    const workflowRunsMatch = path.match(/^\/api\/workflows\/([^/]+)\/runs$/);
    if (workflowRunsMatch && method === "GET") {
      const workflowId = workflowRunsMatch[1];
      const runs = state.runs
        .filter((run) => run.workflowId === workflowId)
        .map((run) => ({
          id: run.id,
          workflowId: run.workflowId,
          workflowVersion: run.workflowVersion,
          testMode: run.testMode,
          status: run.status,
          checkpointNodeId: run.checkpointNodeId,
          resumeFromRunId: run.resumeFromRunId,
          startedAt: run.startedAt,
          finishedAt: run.finishedAt,
          createdAt: run.createdAt
        }));
      return json(route, runs);
    }

    const workflowHistoryMatch = path.match(/^\/api\/workflows\/([^/]+)\/history$/);
    if (workflowHistoryMatch && method === "GET") {
      return json(route, { workflowId: workflowHistoryMatch[1], versions: state.versions[workflowHistoryMatch[1]] || [], events: [] });
    }

    const workflowPresenceMatch = path.match(/^\/api\/workflows\/([^/]+)\/collab\/presence$/);
    if (workflowPresenceMatch && method === "GET") return json(route, { workflowId: workflowPresenceMatch[1], presence: [] });

    const workflowCommentsMatch = path.match(/^\/api\/workflows\/([^/]+)\/comments$/);
    if (workflowCommentsMatch && method === "GET") return json(route, []);
    if (workflowCommentsMatch && method === "POST") return json(route, { id: `comment-${Date.now()}`, ...body, createdAt: nowIso(), updatedAt: nowIso(), authorUsername: "local", authorRole: "admin" });

    const workflowMatch = path.match(/^\/api\/workflows\/([^/]+)$/);
    if (workflowMatch && method === "GET") {
      const workflow = state.workflows.find((item) => item.id === workflowMatch[1]);
      return workflow ? json(route, workflow) : json(route, { error: "Workflow not found" }, 404);
    }
    if (workflowMatch && method === "PUT") {
      const workflow = state.workflows.find((item) => item.id === workflowMatch[1]);
      if (!workflow) return json(route, { error: "Workflow not found" }, 404);
      if (body.name !== undefined) workflow.name = String(body.name);
      if (body.definition !== undefined) {
        workflow.definition = body.definition as Record<string, unknown>;
        workflow.draftDefinition = body.definition as Record<string, unknown>;
      }
      workflow.updatedAt = nowIso();
      return json(route, workflow);
    }
    if (workflowMatch && method === "DELETE") {
      state.workflows = state.workflows.filter((item) => item.id !== workflowMatch[1]);
      state.runs = state.runs.filter((run) => run.workflowId !== workflowMatch[1]);
      return json(route, { ok: true });
    }

    if (path === "/api/runs/start" && method === "POST") {
      state.counters.run += 1;
      const runId = `run-${state.counters.run}`;
      const now = nowIso();
      const run: RunRecord = {
        id: runId,
        workflowId: String(body.workflowId || "wf-1"),
        workflowVersion: 1,
        testMode: Boolean(body.testMode),
        status: "SUCCEEDED",
        checkpointNodeId: "start",
        resumeFromRunId: body.resumeFromRunId ? String(body.resumeFromRunId) : null,
        startedAt: now,
        finishedAt: now,
        createdAt: now,
        logs: [{ ts: now, nodeId: "start", status: "done" }],
        nodeStates: { start: { status: "succeeded", attempts: 1, durationMs: 5 } },
        context: (body.inputData as Record<string, unknown>) || {},
        artifacts: [],
        inputData: body.inputData
      };
      state.runs.unshift(run);
      return json(route, {
        id: run.id,
        workflowId: run.workflowId,
        workflowVersion: run.workflowVersion,
        testMode: run.testMode,
        status: run.status,
        checkpointNodeId: run.checkpointNodeId,
        resumeFromRunId: run.resumeFromRunId,
        startedAt: run.startedAt,
        finishedAt: run.finishedAt,
        createdAt: run.createdAt
      });
    }

    const runDiffMatch = path.match(/^\/api\/runs\/([^/]+)\/diff-last-success$/);
    if (runDiffMatch && method === "GET") return json(route, { hasBaseline: false, changes: [] });

    const runApproveMatch = path.match(/^\/api\/runs\/([^/]+)\/approve$/);
    if (runApproveMatch && method === "POST") return json(route, { ok: true });

    const runMatch = path.match(/^\/api\/runs\/([^/]+)$/);
    if (runMatch && method === "GET") {
      const run = state.runs.find((item) => item.id === runMatch[1]);
      return run ? json(route, run) : json(route, { error: "Run not found" }, 404);
    }

    if (path === "/api/system/preflight" && method === "POST") return json(route, { ready: true, checks: {}, messages: [] });
    if (path === "/api/system/time" && method === "GET") return json(route, { nowUtc: nowIso(), timezone: "UTC", localTime: nowIso() });

    if (path === "/api/schedules/presets" && method === "GET") return json(route, [{ id: "daily", name: "Daily 09:00", description: "Daily run", cron: "0 9 * * *" }]);
    if (path === "/api/schedules/upcoming" && method === "GET") return json(route, { items: [] });
    if (path === "/api/schedules/preview" && method === "GET") return json(route, { cron: String(url.searchParams.get("cron") || ""), timezone: String(url.searchParams.get("timezone") || "UTC"), nextRunAtUtc: nowIso(), nextRunAtLocal: nowIso() });
    if (path === "/api/schedules" && method === "GET") return json(route, state.schedules);
    if (path === "/api/schedules" && method === "POST") {
      const schedule = { id: `schedule-${Date.now()}`, ...body, enabled: true, nextRunAtLocal: nowIso() };
      state.schedules.unshift(schedule);
      return json(route, schedule);
    }

    if (path === "/api/metrics/dashboard" && method === "GET") return json(route, buildDashboard(state));
    if (path === "/api/mining/summary" && method === "GET") {
      return json(route, {
        periodDays: Number(url.searchParams.get("days") || 14),
        generatedAt: nowIso(),
        summary: {
          totalRuns: state.runs.length,
          failedRuns: state.runs.filter((run) => run.status === "FAILED").length,
          waitingApprovals: 0
        },
        bottlenecks: [{ nodeId: "extract", avgDurationMs: 420, runs: Math.max(1, state.runs.length), failures: 0 }],
        processVariants: [{ sequence: "start -> extract -> submit", count: Math.max(1, state.runs.length) }],
        opportunities: [{ workflowId: state.workflows[0]?.id || "wf-1", workflowName: state.workflows[0]?.name || "Demo Workflow", failures: 0, waitingApprovals: 0, totalRuns: Math.max(1, state.runs.length), automationOpportunityScore: 24 }],
        topHumanActions: [{ key: "run:run.start", count: 3 }]
      });
    }

    if (path === "/api/orchestrator/overview" && method === "GET") return json(route, orchestratorOverview(state));
    if (path === "/api/orchestrator/robots" && method === "GET") return json(route, state.robots);
    if (path === "/api/orchestrator/robots" && method === "POST") {
      state.counters.robot += 1;
      const robot: OrchestratorRobot = {
        id: `robot-${state.counters.robot}`,
        name: String(body.name || `Robot ${state.counters.robot}`),
        mode: body.mode === "attended" ? "attended" : "unattended",
        enabled: body.enabled !== false,
        labels: [],
        maxConcurrentJobs: Number(body.maxConcurrentJobs || 1),
        createdAt: nowIso(),
        updatedAt: nowIso()
      };
      state.robots.push(robot);
      return json(route, robot);
    }
    const robotMatch = path.match(/^\/api\/orchestrator\/robots\/([^/]+)$/);
    if (robotMatch && method === "PUT") {
      const robot = state.robots.find((item) => item.id === robotMatch[1]);
      if (!robot) return json(route, { error: "Robot not found" }, 404);
      Object.assign(robot, body, { updatedAt: nowIso() });
      return json(route, robot);
    }

    if (path === "/api/orchestrator/jobs" && method === "GET") {
      const workflowId = url.searchParams.get("workflowId");
      const jobs = workflowId ? state.jobs.filter((job) => job.workflowId === workflowId) : state.jobs;
      return json(route, jobs);
    }
    if (path === "/api/orchestrator/jobs" && method === "POST") {
      state.counters.job += 1;
      const job: OrchestratorJob = {
        id: `job-${state.counters.job}`,
        workflowId: String(body.workflowId || "wf-1"),
        mode: body.mode === "attended" ? "attended" : "unattended",
        status: "queued",
        robotId: body.robotId ? String(body.robotId) : undefined,
        testMode: Boolean(body.testMode),
        inputData: body.inputData,
        createdAt: nowIso(),
        updatedAt: nowIso()
      };
      state.jobs.unshift(job);
      return json(route, job);
    }
    const dispatchMatch = path.match(/^\/api\/orchestrator\/jobs\/([^/]+)\/dispatch$/);
    if (dispatchMatch && method === "POST") {
      const job = state.jobs.find((item) => item.id === dispatchMatch[1]);
      if (!job) return json(route, { error: "Job not found" }, 404);
      state.counters.run += 1;
      const runId = `run-${state.counters.run}`;
      const now = nowIso();
      const run: RunRecord = {
        id: runId,
        workflowId: job.workflowId,
        workflowVersion: 1,
        testMode: job.testMode,
        status: "SUCCEEDED",
        checkpointNodeId: "start",
        resumeFromRunId: null,
        startedAt: now,
        finishedAt: now,
        createdAt: now,
        logs: [{ ts: now, nodeId: "start", status: "done" }],
        nodeStates: { start: { status: "succeeded", attempts: 1, durationMs: 5 } },
        context: {},
        artifacts: [],
        inputData: job.inputData
      };
      state.runs.unshift(run);
      job.status = "dispatched";
      job.runId = runId;
      job.runStatus = "SUCCEEDED";
      job.updatedAt = nowIso();
      return json(route, { job, run });
    }
    const syncMatch = path.match(/^\/api\/orchestrator\/jobs\/([^/]+)\/sync$/);
    if (syncMatch && method === "POST") {
      const job = state.jobs.find((item) => item.id === syncMatch[1]);
      if (!job) return json(route, { error: "Job not found" }, 404);
      if (job.status === "dispatched") {
        job.status = "completed";
        job.runStatus = "SUCCEEDED";
        job.updatedAt = nowIso();
      }
      return json(route, job);
    }

    if (path === "/api/integrations" && method === "GET") return json(route, state.integrations);
    if (path === "/api/integrations/import/csv" && method === "POST") return json(route, { rows: [] });
    if (path.endsWith("/test") && path.startsWith("/api/integrations/") && method === "POST") return json(route, { ok: true, message: "ok" });

    if (path === "/api/secrets" && method === "GET") return json(route, state.secrets);
    if (path === "/api/secrets" && method === "POST") {
      const key = String(body.key || "");
      const existing = state.secrets.find((item) => item.key === key);
      if (existing) existing.updatedAt = nowIso();
      else state.secrets.push({ key, updatedAt: nowIso() });
      return json(route, { ok: true });
    }

    if (path === "/api/admin/users" && method === "GET") return json(route, []);
    if (path === "/api/admin/roles" && method === "GET") return json(route, [{ role: "admin", permissions: ["*"] }]);
    if (path === "/api/admin/audit" && method === "GET") return json(route, []);
    if (path === "/api/webhooks" && method === "GET") return json(route, []);
    if (path === "/api/webhooks/events" && method === "GET") return json(route, ["run.failed", "run.succeeded"]);

    return json(route, { ok: true });
  });
}
