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
  pack?: string;
  phase?: "phase-1" | "phase-2" | "phase-3";
  status: "available" | "planned";
  description: string;
  aliases?: string[];
};

export type ActivityRoadmapPack = {
  id: string;
  label: string;
  phase: "phase-1" | "phase-2" | "phase-3";
  total: number;
  available: number;
  planned: number;
  activityIds: string[];
};

export type ActivityCatalog = {
  targetLibrarySize: number;
  currentTotal: number;
  availableCount: number;
  plannedCount: number;
  byCategory: Record<string, number>;
  byPhase?: Record<string, number>;
  byPack?: Record<string, number>;
  roadmap?: ActivityRoadmapPack[];
  phaseFocus?: {
    now: "phase-1" | "phase-2" | "phase-3";
    next: "phase-1" | "phase-2" | "phase-3";
    later: "phase-1" | "phase-2" | "phase-3";
  };
  items: ActivityCatalogItem[];
};

export type TemplateSetupField = {
  id: string;
  label: string;
  kind: "text" | "url" | "integration" | "selector" | "json";
  required: boolean;
  placeholder?: string;
  defaultValue?: string;
  help?: string;
};

export type TemplateSetupCheck = {
  id: string;
  label: string;
  type: "preflight" | "integration";
  integrationId?: string;
};

export type TemplateSetupGuide = {
  requiredInputs: TemplateSetupField[];
  connectionChecks: TemplateSetupCheck[];
  sampleInput: Record<string, unknown>;
  runbook: string[];
};

export type WorkflowTemplateSummary = {
  id: string;
  name: string;
  category: string;
  description?: string;
  difficulty?: string;
  useCase?: string;
  tags?: string[];
  nodes?: number;
  setup?: TemplateSetupGuide;
};

export type WorkflowTemplateDetail = WorkflowTemplateSummary & {
  definition: WorkflowDefinition;
};

export type AutopilotPlan = {
  name: string;
  description: string;
  capabilities: string[];
  warnings: string[];
  confidence: number;
  requiresConfirmation: boolean;
  fallbackUsed: boolean;
  fallbackTemplateId?: string;
  fallbackOptions: Array<{
    id: string;
    name: string;
    description: string;
    reason: string;
  }>;
  nodeInsights: Array<{
    nodeId: string;
    nodeType: string;
    label: string;
    confidence: number;
    reason: string;
    warnings: string[];
  }>;
  definition: WorkflowDefinition;
};

export type DocumentUnderstandingResult = {
  rawText: string;
  fields: Record<string, string | null>;
  entities: Array<{ key: string; value: string }>;
  confidence: number;
};

export type OrchestratorRobot = {
  id: string;
  name: string;
  mode: "attended" | "unattended";
  enabled: boolean;
  labels: string[];
  maxConcurrentJobs: number;
  lastHeartbeatAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type OrchestratorJob = {
  id: string;
  workflowId: string;
  mode: "attended" | "unattended";
  status: "queued" | "dispatched" | "completed" | "failed" | "cancelled";
  robotId?: string;
  testMode: boolean;
  inputData?: unknown;
  runId?: string;
  runStatus?: string | null;
  error?: string;
  createdAt: string;
  updatedAt: string;
};

export type OrchestratorOverview = {
  robotCount: number;
  enabledRobots: number;
  queuedJobs: number;
  dispatchedJobs: number;
  byStatus: Record<string, number>;
};

export type MiningSummary = {
  periodDays: number;
  generatedAt: string;
  summary: {
    totalRuns: number;
    failedRuns: number;
    waitingApprovals: number;
  };
  bottlenecks: Array<{
    nodeId: string;
    avgDurationMs: number;
    runs: number;
    failures: number;
  }>;
  processVariants: Array<{
    sequence: string;
    count: number;
  }>;
  opportunities: Array<{
    workflowId: string;
    workflowName: string;
    failures: number;
    waitingApprovals: number;
    totalRuns: number;
    automationOpportunityScore: number;
  }>;
  topHumanActions: Array<{
    key: string;
    count: number;
  }>;
};
