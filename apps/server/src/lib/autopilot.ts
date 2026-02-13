import type { WorkflowDefinition, WorkflowNode } from "./types.js";

type PlanResult = {
  name: string;
  description: string;
  capabilities: string[];
  warnings: string[];
  definition: WorkflowDefinition;
};

const EXECUTION_DEFAULTS = {
  globalTimeoutMs: 1800000,
  defaultRetries: 2,
  defaultNodeTimeoutMs: 30000
};

function compactName(rawPrompt: string) {
  const cleaned = rawPrompt
    .replace(/[^a-zA-Z0-9\s-]/g, " ")
    .trim()
    .split(/\s+/)
    .slice(0, 6)
    .join(" ");
  return cleaned ? `Autopilot: ${cleaned}` : "Autopilot Workflow";
}

function hasAny(prompt: string, terms: string[]) {
  return terms.some((term) => prompt.includes(term));
}

function makeNode(id: string, x: number, data: Record<string, unknown>): WorkflowNode {
  return {
    id,
    type: "action",
    position: { x, y: 120 },
    data
  };
}

export function buildAutopilotPlan(promptRaw: string, preferredName?: string): PlanResult {
  const prompt = promptRaw.toLowerCase();
  const nodes: WorkflowNode[] = [makeNode("start", 80, { type: "start", label: "Start" })];
  const capabilities = new Set<string>();
  const warnings: string[] = [];

  if (hasAny(prompt, ["web", "website", "browser", "url", "portal"])) {
    nodes.push(
      makeNode("navigate", 330, {
        type: "playwright_navigate",
        label: "Navigate",
        url: "https://example.com"
      })
    );
    capabilities.add("web-automation");
  }

  if (hasAny(prompt, ["form", "login", "sign in", "fill"])) {
    nodes.push(
      makeNode("fill", 580, {
        type: "playwright_fill",
        label: "Fill Form",
        selector: "input[name=email]",
        value: "{{email}}"
      }),
      makeNode("submit", 830, {
        type: "playwright_click",
        label: "Submit",
        selector: "button[type=submit]"
      })
    );
    capabilities.add("form-automation");
  }

  if (hasAny(prompt, ["extract", "scrape", "table", "screen scrape", "data scrape"])) {
    nodes.push(
      makeNode("extract", 1080, {
        type: "playwright_extract",
        label: "Extract Data",
        selector: "table, .result, main",
        saveAs: "extractedData"
      })
    );
    capabilities.add("scraping");
  }

  if (hasAny(prompt, ["api", "webhook", "http", "endpoint"])) {
    nodes.push(
      makeNode("api", 1330, {
        type: "http_request",
        label: "Send API Request",
        method: "POST",
        url: "https://example.com/api",
        body: { payload: "{{extractedData}}" }
      })
    );
    capabilities.add("api-integration");
  }

  if (hasAny(prompt, ["csv", "excel", "spreadsheet"])) {
    nodes.push(
      makeNode("csv", 1580, {
        type: "data_import_csv",
        label: "Import CSV",
        outputKey: "csvRows"
      })
    );
    capabilities.add("data-import");
    if (hasAny(prompt, ["excel"])) {
      warnings.push("Excel-specific activities are in planned state; using CSV import starter step.");
    }
  }

  if (hasAny(prompt, ["ai", "classify", "summarize", "clean", "understand"])) {
    nodes.push(
      makeNode("llm", 1830, {
        type: "transform_llm",
        label: "AI Transform",
        inputKey: "extractedData",
        outputKey: "aiOutput",
        strictJson: true
      })
    );
    capabilities.add("ai-transform");
  }

  if (hasAny(prompt, ["approval", "review", "human"])) {
    nodes.push(
      makeNode("approval", 2080, {
        type: "manual_approval",
        label: "Manual Approval",
        message: "Please review output before final submit."
      })
    );
    capabilities.add("human-in-the-loop");
  }

  if (hasAny(prompt, ["validate", "guard", "check"])) {
    nodes.push(
      makeNode("validate", 2330, {
        type: "submit_guard",
        label: "Validate Output",
        inputKey: "aiOutput",
        schema: { type: "object" }
      })
    );
    capabilities.add("validation");
  }

  if (hasAny(prompt, ["sap", "java", ".net", "dotnet"])) {
    warnings.push("Enterprise app scraping adapters (SAP/Java/.NET) are planned; generated a generic starter workflow.");
  }
  if (hasAny(prompt, ["pdf", "document understanding"])) {
    warnings.push("Document Understanding is planned; generated AI transform placeholders.");
  }
  if (hasAny(prompt, ["clipboard"])) {
    warnings.push("Clipboard AI is planned; include manual clipboard nodes once added.");
  }

  if (nodes.length === 1) {
    nodes.push(
      makeNode("set-context", 330, {
        type: "set_variable",
        label: "Set Context",
        key: "task",
        value: promptRaw
      })
    );
    capabilities.add("orchestration");
  }

  const edges = nodes.slice(1).map((node, index) => ({
    id: `e-${nodes[index].id}-${node.id}`,
    source: nodes[index].id,
    target: node.id
  }));

  return {
    name: preferredName?.trim() || compactName(promptRaw),
    description: `Autopilot draft generated from prompt: "${promptRaw.trim()}"`,
    capabilities: Array.from(capabilities),
    warnings,
    definition: {
      nodes,
      edges,
      execution: EXECUTION_DEFAULTS
    }
  };
}
