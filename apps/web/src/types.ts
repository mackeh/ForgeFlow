import type { Edge, Node } from "reactflow";

export type WorkflowDefinition = {
  nodes: Node[];
  edges: Edge[];
  execution?: {
    globalTimeoutMs?: number;
    defaultRetries?: number;
    defaultNodeTimeoutMs?: number;
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

export type WorkflowSummary = {
  id: string;
  name: string;
  publishedVersion?: number | null;
  createdAt: string;
  updatedAt: string;
};

export type WorkflowRecord = WorkflowSummary & {
  definition?: WorkflowDefinition | null;
  draftDefinition?: WorkflowDefinition | null;
  publishedDefinition?: WorkflowDefinition | null;
};

export type WorkflowVersion = {
  id: string;
  version: number;
  status: string;
  notes?: string | null;
  createdAt: string;
};

export type WorkflowRunSummary = {
  id: string;
  workflowId: string;
  workflowVersion?: number | null;
  testMode: boolean;
  status: string;
  checkpointNodeId?: string | null;
  resumeFromRunId?: string | null;
  startedAt?: string | null;
  finishedAt?: string | null;
  createdAt: string;
};

export type WorkflowRunDetail = WorkflowRunSummary & {
  logs?: unknown;
  nodeStates?: unknown;
  context?: unknown;
  artifacts?: unknown;
  inputData?: unknown;
};

export type ActionNodeData = {
  type?: string;
  label?: string;
  selector?: string;
  confidence?: number;
  imagePath?: string;
  __runStatus?: string;
  __runDurationMs?: number;
  __runStartedAt?: string;
  __runAttempts?: number;
  __runError?: string;
  [key: string]: unknown;
};

export type ActivityCatalogItem = {
  id: string;
  label: string;
  category: string;
  status: "available" | "planned";
  description: string;
  aliases?: string[];
};

export type ActivityCatalog = {
  targetLibrarySize: number;
  currentTotal: number;
  availableCount: number;
  plannedCount: number;
  byCategory: Record<string, number>;
  items: ActivityCatalogItem[];
};

export type AutopilotPlan = {
  name: string;
  description: string;
  capabilities: string[];
  warnings: string[];
  definition: WorkflowDefinition;
};
