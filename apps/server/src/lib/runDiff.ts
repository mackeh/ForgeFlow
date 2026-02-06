type NodeStateRecord = Record<string, { status?: string; durationMs?: number }>;
type RunDiffChange = {
  nodeId: string;
  statusBefore?: string;
  statusNow?: string;
  durationBefore?: number;
  durationNow?: number;
  changed: boolean;
};
type RunDiffResult = {
  hasBaseline: boolean;
  baselineRunId?: string;
  changes: RunDiffChange[];
};

export function diffRunNodeStates(
  run: { id: string; nodeStates?: unknown },
  previousSuccess: { id: string; nodeStates?: unknown } | null
): RunDiffResult {
  if (!previousSuccess) {
    return { hasBaseline: false, changes: [] };
  }

  const currentStates = ((run.nodeStates || {}) as NodeStateRecord) || {};
  const previousStates = ((previousSuccess.nodeStates || {}) as NodeStateRecord) || {};

  const allNodeIds = Array.from(new Set([...Object.keys(currentStates), ...Object.keys(previousStates)]));
  const changes = allNodeIds
    .map((nodeId) => {
      const curr = currentStates[nodeId] || {};
      const old = previousStates[nodeId] || {};
      return {
        nodeId,
        statusBefore: old.status,
        statusNow: curr.status,
        durationBefore: old.durationMs,
        durationNow: curr.durationMs,
        changed: old.status !== curr.status || Number(old.durationMs || 0) !== Number(curr.durationMs || 0)
      };
    })
    .filter((row) => row.changed);

  return { hasBaseline: true, baselineRunId: previousSuccess.id, changes };
}
