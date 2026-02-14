import { listWorkflowTemplateDefinitions, renderWorkflowTemplateDefinition, type WorkflowTemplate } from "./templates.js";

function isNonEmptyString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0;
}

function hasSetupPlaceholder(value: unknown): boolean {
  if (typeof value === "string") return /{{\s*setup\.[a-zA-Z0-9_-]+\s*}}/.test(value);
  if (Array.isArray(value)) return value.some((item) => hasSetupPlaceholder(item));
  if (value && typeof value === "object") return Object.values(value as Record<string, unknown>).some((nested) => hasSetupPlaceholder(nested));
  return false;
}

export function validateWorkflowTemplate(template: WorkflowTemplate & { setup?: any }) {
  const errors: string[] = [];

  if (!isNonEmptyString(template.id)) errors.push("Missing template id");
  if (!isNonEmptyString(template.name)) errors.push("Missing template name");
  if (!isNonEmptyString(template.description)) errors.push("Missing template description");
  if (!isNonEmptyString(template.category)) errors.push("Missing template category");
  if (!isNonEmptyString(template.useCase)) errors.push("Missing template useCase");
  if (!Array.isArray(template.tags) || template.tags.length === 0) errors.push("Template tags must be non-empty");

  const definition = (template.definition || {}) as Record<string, unknown>;
  const nodes = Array.isArray(definition.nodes) ? (definition.nodes as Array<Record<string, any>>) : [];
  const edges = Array.isArray(definition.edges) ? (definition.edges as Array<Record<string, any>>) : [];

  if (!nodes.length) errors.push("Definition must include at least one node");
  if (!edges.length) errors.push("Definition must include at least one edge");

  const nodeIds = new Set<string>();
  for (const node of nodes) {
    const nodeId = typeof node?.id === "string" ? node.id.trim() : "";
    if (!nodeId) {
      errors.push("Node is missing id");
      continue;
    }
    if (nodeIds.has(nodeId)) errors.push(`Duplicate node id: ${nodeId}`);
    nodeIds.add(nodeId);
  }

  const hasStart = nodes.some((node) => String(node?.data?.type || "") === "start");
  if (!hasStart) errors.push("Definition must include a start node");

  const edgeIds = new Set<string>();
  for (const edge of edges) {
    const edgeId = typeof edge?.id === "string" ? edge.id.trim() : "";
    const source = typeof edge?.source === "string" ? edge.source.trim() : "";
    const target = typeof edge?.target === "string" ? edge.target.trim() : "";
    if (!edgeId) errors.push("Edge is missing id");
    if (edgeId && edgeIds.has(edgeId)) errors.push(`Duplicate edge id: ${edgeId}`);
    if (edgeId) edgeIds.add(edgeId);
    if (!source || !target) {
      errors.push(`Edge ${edgeId || "<unknown>"} is missing source/target`);
      continue;
    }
    if (!nodeIds.has(source)) errors.push(`Edge ${edgeId} source does not exist: ${source}`);
    if (!nodeIds.has(target)) errors.push(`Edge ${edgeId} target does not exist: ${target}`);
  }

  const execution = (definition.execution || {}) as Record<string, unknown>;
  const requiredExecutionNumbers = ["globalTimeoutMs", "defaultRetries", "defaultNodeTimeoutMs"] as const;
  for (const key of requiredExecutionNumbers) {
    const value = execution[key];
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
      errors.push(`Execution.${key} must be a non-negative number`);
    }
  }

  const setup = template.setup as Record<string, unknown> | undefined;
  if (!setup || typeof setup !== "object") {
    errors.push("Template setup guide is required");
  } else {
    const requiredInputs = Array.isArray(setup.requiredInputs) ? setup.requiredInputs : [];
    const connectionChecks = Array.isArray(setup.connectionChecks) ? setup.connectionChecks : [];
    const sampleInput = setup.sampleInput;
    if (requiredInputs.length === 0) errors.push("Template setup requires at least one required/checklist input");
    if (connectionChecks.length === 0) errors.push("Template setup requires at least one connection check");
    if (!sampleInput || typeof sampleInput !== "object" || Array.isArray(sampleInput)) {
      errors.push("Template setup sampleInput must be an object");
    }
  }

  if (template.setup) {
    const rendered = renderWorkflowTemplateDefinition(template as WorkflowTemplate & { setup: any });
    if (hasSetupPlaceholder(rendered)) {
      errors.push("Rendered definition still contains unresolved setup placeholders");
    }
  }

  return errors;
}

export function validateAllWorkflowTemplates() {
  return listWorkflowTemplateDefinitions().map((template) => ({
    templateId: template.id,
    errors: validateWorkflowTemplate(template)
  }));
}
