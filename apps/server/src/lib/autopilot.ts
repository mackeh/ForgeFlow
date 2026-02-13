import type { WorkflowDefinition, WorkflowNode } from "./types.js";

type AutopilotNodeInsight = {
  nodeId: string;
  nodeType: string;
  label: string;
  confidence: number;
  reason: string;
  warnings: string[];
};

type AutopilotFallbackOption = {
  id: string;
  name: string;
  description: string;
  reason: string;
};

type PlanResult = {
  name: string;
  description: string;
  capabilities: string[];
  warnings: string[];
  confidence: number;
  requiresConfirmation: boolean;
  fallbackUsed: boolean;
  fallbackTemplateId?: string;
  fallbackOptions: AutopilotFallbackOption[];
  nodeInsights: AutopilotNodeInsight[];
  definition: WorkflowDefinition;
};

const EXECUTION_DEFAULTS = {
  globalTimeoutMs: 1800000,
  defaultRetries: 2,
  defaultNodeTimeoutMs: 30000
};

const FALLBACK_OPTIONS: AutopilotFallbackOption[] = [
  {
    id: "web_intake_ai_review",
    name: "Web Intake + AI Review",
    description: "Navigate, extract page content, transform with AI, and route for approval.",
    reason: "Best for broad web-based operational tasks."
  },
  {
    id: "data_cleanup_review",
    name: "Data Cleanup + Validation",
    description: "Import CSV, normalize values with AI, validate output, and add approval.",
    reason: "Best for generic data wrangling prompts."
  },
  {
    id: "api_sync_starter",
    name: "API Sync Starter",
    description: "Set run context, send API request, and require human approval.",
    reason: "Best for broad integration and handoff requests."
  }
];

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

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function buildNodeInsights(nodes: WorkflowNode[], prompt: string, fallbackUsed: boolean): AutopilotNodeInsight[] {
  return nodes.map((node) => {
    const nodeType = String(node.data?.type || "");
    const label = String(node.data?.label || node.id);
    if (nodeType === "start") {
      return {
        nodeId: node.id,
        nodeType,
        label,
        confidence: 0.99,
        reason: "Mandatory workflow entry node.",
        warnings: []
      };
    }

    let confidence = 0.7;
    let reason = "Generated from recognized prompt intent.";
    const warnings: string[] = [];

    if (fallbackUsed) {
      confidence -= 0.12;
      reason = "Generated from fallback template because prompt intent was broad.";
    }

    if (nodeType === "playwright_navigate") {
      if (hasAny(prompt, ["web", "website", "browser", "url", "portal"])) confidence += 0.16;
      else warnings.push("Target URL is placeholder and should be refined.");
      reason = "Web navigation step inferred from prompt.";
    }

    if (nodeType === "playwright_extract") {
      if (hasAny(prompt, ["extract", "scrape", "table", "screen scrape", "data scrape"])) confidence += 0.16;
      else warnings.push("Selector is generic and may need adjustment.");
      reason = "Data extraction step inferred from prompt.";
    }

    if (nodeType === "playwright_fill" || nodeType === "playwright_click") {
      if (hasAny(prompt, ["form", "login", "sign in", "fill"])) confidence += 0.13;
      else warnings.push("Recorded selectors/values should be reviewed.");
      reason = "Form interaction inferred from prompt.";
    }

    if (nodeType === "http_request") {
      if (hasAny(prompt, ["api", "webhook", "http", "endpoint"])) confidence += 0.15;
      else warnings.push("API URL/body are starter placeholders.");
      reason = "Integration call inferred from prompt.";
    }

    if (nodeType === "transform_llm") {
      if (hasAny(prompt, ["ai", "classify", "summarize", "clean", "understand"])) confidence += 0.14;
      reason = "AI transformation inferred from prompt.";
    }

    if (nodeType === "data_import_csv") {
      if (hasAny(prompt, ["csv", "excel", "spreadsheet"])) confidence += 0.14;
      reason = "Structured file ingestion inferred from prompt.";
    }

    if (nodeType === "manual_approval") {
      if (hasAny(prompt, ["approval", "review", "human"])) confidence += 0.14;
      reason = "Human checkpoint inferred from prompt/risk profile.";
    }

    if (nodeType === "submit_guard") {
      if (hasAny(prompt, ["validate", "guard", "check"])) confidence += 0.12;
      reason = "Validation guard inferred from prompt.";
    }

    if (nodeType === "set_variable") {
      confidence = Math.min(confidence, 0.62);
      reason = "Context bootstrap used to seed starter workflow.";
    }

    return {
      nodeId: node.id,
      nodeType,
      label,
      confidence: round2(Math.max(0.25, Math.min(0.98, confidence))),
      reason,
      warnings
    };
  });
}

function chooseFallbackTemplate(prompt: string) {
  if (hasAny(prompt, ["csv", "excel", "spreadsheet", "report", "dataset", "clean", "normalize"])) {
    return FALLBACK_OPTIONS[1];
  }
  if (hasAny(prompt, ["api", "webhook", "endpoint", "integration", "sync"])) {
    return FALLBACK_OPTIONS[2];
  }
  return FALLBACK_OPTIONS[0];
}

function buildFallbackNodes(templateId: string): { nodes: WorkflowNode[]; capabilities: string[]; warnings: string[] } {
  const start = makeNode("start", 80, { type: "start", label: "Start" });
  if (templateId === "data_cleanup_review") {
    return {
      nodes: [
        start,
        makeNode("csv", 330, { type: "data_import_csv", label: "Import CSV", outputKey: "csvRows" }),
        makeNode("llm", 580, {
          type: "transform_llm",
          label: "Normalize Data",
          inputKey: "csvRows",
          outputKey: "normalizedRows",
          strictJson: true
        }),
        makeNode("validate", 830, {
          type: "submit_guard",
          label: "Validate Rows",
          inputKey: "normalizedRows",
          schema: { type: "array" }
        }),
        makeNode("approval", 1080, {
          type: "manual_approval",
          label: "Approve Output",
          message: "Please review normalized rows before submit."
        })
      ],
      capabilities: ["data-import", "ai-transform", "validation", "human-in-the-loop"],
      warnings: ["Prompt was broad; generated a data cleanup starter template."]
    };
  }
  if (templateId === "api_sync_starter") {
    return {
      nodes: [
        start,
        makeNode("set-context", 330, {
          type: "set_variable",
          label: "Set Request Context",
          key: "task",
          value: "autopilot-api-sync"
        }),
        makeNode("api", 580, {
          type: "http_request",
          label: "Send API Request",
          method: "POST",
          url: "https://example.com/api",
          body: { task: "{{task}}" }
        }),
        makeNode("approval", 830, {
          type: "manual_approval",
          label: "Review API Response",
          message: "Confirm API output before downstream actions."
        })
      ],
      capabilities: ["api-integration", "orchestration", "human-in-the-loop"],
      warnings: ["Prompt was broad; generated an API sync starter template."]
    };
  }
  return {
    nodes: [
      start,
      makeNode("navigate", 330, {
        type: "playwright_navigate",
        label: "Navigate",
        url: "https://example.com"
      }),
      makeNode("extract", 580, {
        type: "playwright_extract",
        label: "Extract Data",
        selector: "main, table, .content",
        saveAs: "pageData"
      }),
      makeNode("llm", 830, {
        type: "transform_llm",
        label: "Summarize Data",
        inputKey: "pageData",
        outputKey: "summary",
        strictJson: true
      }),
      makeNode("approval", 1080, {
        type: "manual_approval",
        label: "Approve Summary",
        message: "Review summary before final handoff."
      })
    ],
    capabilities: ["web-automation", "scraping", "ai-transform", "human-in-the-loop"],
    warnings: ["Prompt was broad; generated a web intake starter template."]
  };
}

function computePlanConfidence(
  insights: AutopilotNodeInsight[],
  warnings: string[],
  fallbackUsed: boolean,
  matchedSignalCount: number
) {
  const avgNodeConfidence =
    insights.length > 0 ? insights.reduce((sum, insight) => sum + insight.confidence, 0) / insights.length : 0.4;
  let confidence = avgNodeConfidence + Math.min(0.2, matchedSignalCount * 0.02) - Math.min(0.2, warnings.length * 0.03);
  if (fallbackUsed) confidence -= 0.06;
  return round2(Math.max(0.2, Math.min(0.97, confidence)));
}

export function buildAutopilotPlan(promptRaw: string, preferredName?: string): PlanResult {
  const prompt = promptRaw.toLowerCase();
  const nodes: WorkflowNode[] = [makeNode("start", 80, { type: "start", label: "Start" })];
  const capabilities = new Set<string>();
  const warnings: string[] = [];
  let fallbackUsed = false;
  let fallbackTemplateId: string | undefined;

  const coreSignals = [
    hasAny(prompt, ["web", "website", "browser", "url", "portal"]),
    hasAny(prompt, ["form", "login", "sign in", "fill"]),
    hasAny(prompt, ["extract", "scrape", "table", "screen scrape", "data scrape"]),
    hasAny(prompt, ["api", "webhook", "http", "endpoint"]),
    hasAny(prompt, ["csv", "excel", "spreadsheet"]),
    hasAny(prompt, ["ai", "classify", "summarize", "clean", "understand"]),
    hasAny(prompt, ["approval", "review", "human"]),
    hasAny(prompt, ["validate", "guard", "check"])
  ];
  const matchedSignalCount = coreSignals.filter(Boolean).length;

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
    const fallback = chooseFallbackTemplate(prompt);
    const fallbackPlan = buildFallbackNodes(fallback.id);
    nodes.splice(0, nodes.length, ...fallbackPlan.nodes);
    fallbackPlan.capabilities.forEach((item) => capabilities.add(item));
    warnings.push(...fallbackPlan.warnings);
    fallbackUsed = true;
    fallbackTemplateId = fallback.id;
  }

  const edges = nodes.slice(1).map((node, index) => ({
    id: `e-${nodes[index].id}-${node.id}`,
    source: nodes[index].id,
    target: node.id
  }));

  const nodeInsights = buildNodeInsights(nodes, prompt, fallbackUsed);
  const confidence = computePlanConfidence(nodeInsights, warnings, fallbackUsed, matchedSignalCount);

  return {
    name: preferredName?.trim() || compactName(promptRaw),
    description: `Autopilot draft generated from prompt: "${promptRaw.trim()}"`,
    capabilities: Array.from(capabilities),
    warnings,
    confidence,
    requiresConfirmation: true,
    fallbackUsed,
    fallbackTemplateId,
    fallbackOptions: FALLBACK_OPTIONS,
    nodeInsights,
    definition: {
      nodes,
      edges,
      execution: EXECUTION_DEFAULTS
    }
  };
}
