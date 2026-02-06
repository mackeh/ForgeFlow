export type WorkflowNodeData = {
  type?: string;
  label?: string;
  [key: string]: unknown;
};

export type WorkflowNode = {
  id: string;
  type?: string;
  position?: { x: number; y: number };
  data?: WorkflowNodeData;
  [key: string]: unknown;
};

export type WorkflowEdge = {
  id?: string;
  source: string;
  target: string;
  [key: string]: unknown;
};

export type WorkflowExecutionConfig = {
  globalTimeoutMs?: number;
  defaultRetries?: number;
  defaultNodeTimeoutMs?: number;
  playwrightHeadless?: boolean;
  [key: string]: unknown;
};

export type WorkflowDefinition = {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  execution?: WorkflowExecutionConfig;
  [key: string]: unknown;
};

export function asWorkflowDefinition(raw: unknown): WorkflowDefinition {
  const fallback: WorkflowDefinition = { nodes: [], edges: [] };
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return fallback;
  const value = raw as Record<string, unknown>;
  return {
    ...value,
    nodes: Array.isArray(value.nodes) ? (value.nodes as WorkflowNode[]) : [],
    edges: Array.isArray(value.edges) ? (value.edges as WorkflowEdge[]) : [],
    execution:
      value.execution && typeof value.execution === "object" && !Array.isArray(value.execution)
        ? (value.execution as WorkflowExecutionConfig)
        : undefined
  };
}
