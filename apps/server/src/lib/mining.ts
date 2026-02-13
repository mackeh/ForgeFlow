type RunLike = {
  id: string;
  status: string;
  workflowId: string;
  workflow?: { id?: string; name?: string } | null;
  createdAt: Date | string;
  startedAt?: Date | string | null;
  finishedAt?: Date | string | null;
  logs?: unknown;
  nodeStates?: unknown;
};

type AuditLike = {
  at: string;
  actorUsername: string;
  action: string;
  resourceType: string;
  success: boolean;
};

function asDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function buildMiningSummary(
  runs: RunLike[],
  audits: AuditLike[],
  options?: {
    days?: number;
    referenceNow?: Date | string | null;
  }
) {
  const days = Math.max(1, Number(options?.days || 14));
  const now = asDate(options?.referenceNow || null) || new Date();
  const start = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const inWindow = runs.filter((run) => {
    const created = asDate(run.createdAt);
    return created ? created >= start : false;
  });

  const bottleneckMap = new Map<string, { nodeId: string; count: number; totalDurationMs: number; failures: number }>();
  const approvalWaitByWorkflow = new Map<string, number>();
  const processVariants = new Map<string, number>();

  for (const run of inWindow) {
    const nodeStates =
      run.nodeStates && typeof run.nodeStates === "object" && !Array.isArray(run.nodeStates)
        ? (run.nodeStates as Record<string, any>)
        : {};
    for (const [nodeId, state] of Object.entries(nodeStates)) {
      const duration = Number(state?.durationMs || 0);
      const status = String(state?.status || "");
      const row = bottleneckMap.get(nodeId) || { nodeId, count: 0, totalDurationMs: 0, failures: 0 };
      row.count += 1;
      row.totalDurationMs += duration > 0 ? duration : 0;
      if (status === "failed") row.failures += 1;
      bottleneckMap.set(nodeId, row);
    }

    const logs = Array.isArray(run.logs) ? (run.logs as Array<Record<string, unknown>>) : [];
    const sequence = logs
      .filter((entry) => String(entry.status || "") === "start" && String(entry.nodeId || "") !== "run")
      .map((entry) => String(entry.nodeId || ""))
      .filter(Boolean)
      .join(" -> ");
    if (sequence) {
      processVariants.set(sequence, (processVariants.get(sequence) || 0) + 1);
    }

    const waitingCount = logs.filter((entry) => String(entry.status || "") === "waiting_approval").length;
    if (waitingCount > 0) {
      approvalWaitByWorkflow.set(run.workflowId, (approvalWaitByWorkflow.get(run.workflowId) || 0) + waitingCount);
    }
  }

  const bottlenecks = Array.from(bottleneckMap.values())
    .map((item) => ({
      nodeId: item.nodeId,
      avgDurationMs: item.count ? Math.round(item.totalDurationMs / item.count) : 0,
      runs: item.count,
      failures: item.failures
    }))
    .sort((a, b) => {
      if (b.avgDurationMs !== a.avgDurationMs) return b.avgDurationMs - a.avgDurationMs;
      return b.failures - a.failures;
    })
    .slice(0, 10);

  const variants = Array.from(processVariants.entries())
    .map(([sequence, count]) => ({ sequence, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const workflowRisk = inWindow
    .reduce<Map<string, { workflowId: string; workflowName: string; failures: number; waitingApprovals: number; totalRuns: number }>>(
      (acc, run) => {
        const id = run.workflowId;
        const row = acc.get(id) || {
          workflowId: id,
          workflowName: String(run.workflow?.name || id),
          failures: 0,
          waitingApprovals: 0,
          totalRuns: 0
        };
        row.totalRuns += 1;
        if (run.status === "FAILED") row.failures += 1;
        row.waitingApprovals = approvalWaitByWorkflow.get(id) || 0;
        acc.set(id, row);
        return acc;
      },
      new Map()
    );

  const opportunities = Array.from(workflowRisk.values())
    .map((item) => ({
      ...item,
      automationOpportunityScore: Math.min(100, Math.round(item.failures * 12 + item.waitingApprovals * 8))
    }))
    .sort((a, b) => b.automationOpportunityScore - a.automationOpportunityScore)
    .slice(0, 8);

  const auditWindow = audits.filter((event) => {
    const at = asDate(event.at);
    return at ? at >= start : false;
  });
  const topHumanActions = Array.from(
    auditWindow.reduce<Map<string, number>>((acc, event) => {
      const key = `${event.resourceType}:${event.action}`;
      acc.set(key, (acc.get(key) || 0) + 1);
      return acc;
    }, new Map())
  )
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return {
    periodDays: days,
    generatedAt: now.toISOString(),
    summary: {
      totalRuns: inWindow.length,
      failedRuns: inWindow.filter((run) => run.status === "FAILED").length,
      waitingApprovals: inWindow.filter((run) => run.status === "WAITING_APPROVAL").length
    },
    bottlenecks,
    processVariants: variants,
    opportunities,
    topHumanActions
  };
}
