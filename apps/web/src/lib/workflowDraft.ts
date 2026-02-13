import type { Edge, Node } from "reactflow";
import type { WorkflowDefinition } from "../types";

const RUNTIME_KEYS = new Set(["__runStatus", "__runDurationMs", "__runStartedAt", "__runAttempts", "__runError"]);

function sanitizeNode(node: Node): Node {
  const data = node.data && typeof node.data === "object" ? { ...(node.data as Record<string, unknown>) } : {};
  for (const key of RUNTIME_KEYS) {
    delete data[key];
  }
  return {
    ...node,
    data
  };
}

export function buildPersistedDefinition(
  defaults: WorkflowDefinition,
  existing: WorkflowDefinition | undefined,
  nodes: Node[],
  edges: Edge[]
): WorkflowDefinition {
  return {
    ...defaults,
    ...(existing || {}),
    nodes: nodes.map(sanitizeNode),
    edges
  };
}

export function hashDefinition(definition: WorkflowDefinition): string {
  return JSON.stringify(definition);
}
