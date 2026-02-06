export type WorkflowTemplate = {
  id: string;
  name: string;
  description: string;
  category: string;
  difficulty: "starter" | "intermediate" | "advanced";
  useCase: string;
  tags: string[];
  definition: Record<string, unknown>;
};

const executionDefaults = {
  globalTimeoutMs: 1800000,
  defaultRetries: 2,
  defaultNodeTimeoutMs: 30000
};

const templates: WorkflowTemplate[] = [
  {
    id: "web-form-submit",
    name: "Web Form Submit",
    description: "Navigate, fill, submit, and validate form data with approval guard.",
    category: "web",
    difficulty: "starter",
    useCase: "Standard web form automation with post-submit validation.",
    tags: ["playwright", "form", "validation"],
    definition: {
      nodes: [
        { id: "start", type: "action", position: { x: 80, y: 80 }, data: { type: "start", label: "Start" } },
        {
          id: "navigate",
          type: "action",
          position: { x: 330, y: 80 },
          data: { type: "playwright_navigate", label: "Navigate", url: "https://example.com/form" }
        },
        {
          id: "fill",
          type: "action",
          position: { x: 580, y: 80 },
          data: { type: "playwright_fill", label: "Fill", selector: "input[name=email]", value: "{{email}}" }
        },
        {
          id: "submit",
          type: "action",
          position: { x: 830, y: 80 },
          data: { type: "playwright_click", label: "Submit", selector: "button[type=submit]" }
        },
        {
          id: "extract",
          type: "action",
          position: { x: 1080, y: 80 },
          data: { type: "playwright_extract", label: "Extract Result", selector: ".result", saveAs: "submissionResult" }
        },
        {
          id: "guard",
          type: "action",
          position: { x: 1330, y: 80 },
          data: {
            type: "submit_guard",
            label: "Validate Output",
            inputKey: "submissionResult",
            schema: { type: "string", minLength: 1 }
          }
        }
      ],
      edges: [
        { id: "e1", source: "start", target: "navigate" },
        { id: "e2", source: "navigate", target: "fill" },
        { id: "e3", source: "fill", target: "submit" },
        { id: "e4", source: "submit", target: "extract" },
        { id: "e5", source: "extract", target: "guard" }
      ],
      execution: executionDefaults
    }
  },
  {
    id: "web-table-scrape",
    name: "Web Table Scrape",
    description: "Collect table data from a page, clean with LLM, and post downstream.",
    category: "web",
    difficulty: "intermediate",
    useCase: "Scrape a report/table and normalize data before sync.",
    tags: ["playwright", "extract", "llm", "http"],
    definition: {
      nodes: [
        { id: "start", type: "action", position: { x: 80, y: 80 }, data: { type: "start", label: "Start" } },
        {
          id: "navigate",
          type: "action",
          position: { x: 330, y: 80 },
          data: { type: "playwright_navigate", label: "Open Report", url: "https://example.com/report" }
        },
        {
          id: "extract",
          type: "action",
          position: { x: 580, y: 80 },
          data: { type: "playwright_extract", label: "Extract Rows", selector: "table tbody", saveAs: "rawRows" }
        },
        {
          id: "clean",
          type: "action",
          position: { x: 830, y: 80 },
          data: {
            type: "transform_llm",
            label: "Clean Rows",
            inputKey: "rawRows",
            outputKey: "cleanRows",
            strictJson: true
          }
        },
        {
          id: "push",
          type: "action",
          position: { x: 1080, y: 80 },
          data: {
            type: "http_request",
            label: "Sync Data",
            method: "POST",
            url: "https://example.com/api/import",
            body: { rows: "{{cleanRows}}" }
          }
        }
      ],
      edges: [
        { id: "e1", source: "start", target: "navigate" },
        { id: "e2", source: "navigate", target: "extract" },
        { id: "e3", source: "extract", target: "clean" },
        { id: "e4", source: "clean", target: "push" }
      ],
      execution: executionDefaults
    }
  },
  {
    id: "api-cleanup-sync",
    name: "API Cleanup Sync",
    description: "Fetch records, clean with local LLM, validate schema, then post downstream.",
    category: "data",
    difficulty: "starter",
    useCase: "ETL-style API to API transformation with schema guard.",
    tags: ["http", "llm", "schema"],
    definition: {
      nodes: [
        { id: "start", type: "action", position: { x: 80, y: 80 }, data: { type: "start", label: "Start" } },
        {
          id: "pull",
          type: "action",
          position: { x: 330, y: 80 },
          data: {
            type: "http_request",
            label: "Fetch Source",
            method: "GET",
            url: "https://example.com/api/source",
            saveAs: "rawPayload"
          }
        },
        {
          id: "llm",
          type: "action",
          position: { x: 580, y: 80 },
          data: {
            type: "transform_llm",
            label: "Clean Data",
            inputKey: "rawPayload",
            outputKey: "cleanPayload",
            strictJson: true
          }
        },
        {
          id: "validate",
          type: "action",
          position: { x: 830, y: 80 },
          data: {
            type: "submit_guard",
            label: "Validate Schema",
            inputKey: "cleanPayload",
            schema: {
              type: "object",
              properties: { id: { type: "string" } },
              required: ["id"]
            }
          }
        },
        {
          id: "push",
          type: "action",
          position: { x: 1080, y: 80 },
          data: {
            type: "http_request",
            label: "Push Target",
            method: "POST",
            url: "https://example.com/api/target",
            body: { payload: "{{cleanPayload}}" }
          }
        }
      ],
      edges: [
        { id: "e1", source: "start", target: "pull" },
        { id: "e2", source: "pull", target: "llm" },
        { id: "e3", source: "llm", target: "validate" },
        { id: "e4", source: "validate", target: "push" }
      ],
      execution: executionDefaults
    }
  },
  {
    id: "conditional-routing",
    name: "Conditional Routing",
    description: "Route high-value records through approval and low-value records through fast lane.",
    category: "data",
    difficulty: "advanced",
    useCase: "Branching control flow for risk-based automation.",
    tags: ["branch", "approval", "control-flow"],
    definition: {
      nodes: [
        { id: "start", type: "action", position: { x: 80, y: 80 }, data: { type: "start", label: "Start" } },
        {
          id: "branch",
          type: "action",
          position: { x: 330, y: 80 },
          data: {
            type: "conditional_branch",
            label: "Amount > 10000?",
            inputKey: "amount",
            operator: "gt",
            right: 10000,
            trueTarget: "manual",
            falseTarget: "fast"
          }
        },
        {
          id: "manual",
          type: "action",
          position: { x: 600, y: 20 },
          data: {
            type: "manual_approval",
            label: "Manager Approval",
            message: "Approve high-value transaction"
          }
        },
        {
          id: "fast",
          type: "action",
          position: { x: 600, y: 150 },
          data: { type: "set_variable", label: "Fast Lane", key: "approvalState", value: "auto-approved" }
        },
        {
          id: "submit",
          type: "action",
          position: { x: 870, y: 80 },
          data: {
            type: "http_request",
            label: "Submit",
            method: "POST",
            url: "https://example.com/api/submit",
            body: { amount: "{{amount}}", state: "{{approvalState}}" }
          }
        }
      ],
      edges: [
        { id: "e1", source: "start", target: "branch" },
        { id: "e2", source: "branch", target: "manual" },
        { id: "e3", source: "branch", target: "fast" },
        { id: "e4", source: "manual", target: "submit" },
        { id: "e5", source: "fast", target: "submit" }
      ],
      execution: executionDefaults
    }
  },
  {
    id: "batch-loop-sync",
    name: "Batch Loop Sync",
    description: "Iterate array payload, transform first item metadata, and sync downstream.",
    category: "data",
    difficulty: "advanced",
    useCase: "Array/batch ingestion with loop metadata in context.",
    tags: ["loop", "batch", "http"],
    definition: {
      nodes: [
        { id: "start", type: "action", position: { x: 80, y: 80 }, data: { type: "start", label: "Start" } },
        {
          id: "fetch",
          type: "action",
          position: { x: 330, y: 80 },
          data: {
            type: "http_request",
            label: "Fetch Batch",
            method: "GET",
            url: "https://example.com/api/batch",
            saveAs: "batchItems"
          }
        },
        {
          id: "loop",
          type: "action",
          position: { x: 580, y: 80 },
          data: {
            type: "loop_iterate",
            label: "Iterate Batch",
            inputKey: "batchItems",
            itemKey: "currentItem",
            indexKey: "currentIndex",
            outputKey: "itemsOut"
          }
        },
        {
          id: "send",
          type: "action",
          position: { x: 830, y: 80 },
          data: {
            type: "http_request",
            label: "Send First Item",
            method: "POST",
            url: "https://example.com/api/ingest",
            body: { item: "{{currentItem}}", idx: "{{currentIndex}}", total: "{{itemsOut}}" }
          }
        }
      ],
      edges: [
        { id: "e1", source: "start", target: "fetch" },
        { id: "e2", source: "fetch", target: "loop" },
        { id: "e3", source: "loop", target: "send" }
      ],
      execution: executionDefaults
    }
  },
  {
    id: "parallel-fanout-sync",
    name: "Parallel Fan-Out Sync",
    description: "Run multiple data fetch/transform tasks concurrently and submit aggregated result.",
    category: "data",
    difficulty: "advanced",
    useCase: "Speed up multi-source integrations with parallel task execution.",
    tags: ["parallel", "http", "llm", "fanout"],
    definition: {
      nodes: [
        { id: "start", type: "action", position: { x: 80, y: 80 }, data: { type: "start", label: "Start" } },
        {
          id: "parallel",
          type: "action",
          position: { x: 330, y: 80 },
          data: {
            type: "parallel_execute",
            label: "Parallel Tasks",
            outputKey: "parallelSummary",
            allowPartial: false,
            tasks: [
              {
                id: "source-a",
                type: "http_request",
                method: "GET",
                url: "https://example.com/api/source-a",
                saveAs: "sourceA"
              },
              {
                id: "source-b",
                type: "http_request",
                method: "GET",
                url: "https://example.com/api/source-b",
                saveAs: "sourceB"
              },
              {
                id: "normalize-a",
                type: "transform_llm",
                inputKey: "sourceA",
                outputKey: "normalizedA",
                strictJson: true
              }
            ]
          }
        },
        {
          id: "submit",
          type: "action",
          position: { x: 620, y: 80 },
          data: {
            type: "http_request",
            label: "Submit Combined",
            method: "POST",
            url: "https://example.com/api/combined",
            body: {
              a: "{{normalizedA}}",
              b: "{{sourceB}}",
              summary: "{{parallelSummary}}"
            }
          }
        }
      ],
      edges: [
        { id: "e1", source: "start", target: "parallel" },
        { id: "e2", source: "parallel", target: "submit" }
      ],
      execution: executionDefaults
    }
  },
  {
    id: "desktop-assisted-submit",
    name: "Desktop Assisted Submit",
    description: "Use desktop image waits/clicks, type values, and require explicit approval before submit.",
    category: "desktop",
    difficulty: "intermediate",
    useCase: "GUI automation for legacy desktop tools.",
    tags: ["desktop", "image-match", "approval"],
    definition: {
      nodes: [
        { id: "start", type: "action", position: { x: 80, y: 80 }, data: { type: "start", label: "Start" } },
        {
          id: "wait-form",
          type: "action",
          position: { x: 330, y: 80 },
          data: {
            type: "desktop_wait_for_image",
            label: "Wait Form",
            imagePath: "/app/recordings/form-title.png",
            timeoutMs: 10000
          }
        },
        {
          id: "click-field",
          type: "action",
          position: { x: 580, y: 80 },
          data: {
            type: "desktop_click_image",
            label: "Click Field",
            imagePath: "/app/recordings/email-field.png",
            confidence: 0.82
          }
        },
        {
          id: "type-value",
          type: "action",
          position: { x: 830, y: 80 },
          data: { type: "desktop_type", label: "Type Value", value: "{{email}}" }
        },
        {
          id: "approval",
          type: "action",
          position: { x: 1080, y: 80 },
          data: { type: "manual_approval", label: "Confirm Before Submit", message: "Approve desktop submit?" }
        }
      ],
      edges: [
        { id: "e1", source: "start", target: "wait-form" },
        { id: "e2", source: "wait-form", target: "click-field" },
        { id: "e3", source: "click-field", target: "type-value" },
        { id: "e4", source: "type-value", target: "approval" }
      ],
      execution: executionDefaults
    }
  },
  {
    id: "desktop-invoice-entry",
    name: "Desktop Invoice Entry",
    description: "Wait for invoice UI, type values, then click submit image target.",
    category: "desktop",
    difficulty: "starter",
    useCase: "Simple desktop data-entry workflow.",
    tags: ["desktop", "typing", "invoicing"],
    definition: {
      nodes: [
        { id: "start", type: "action", position: { x: 80, y: 80 }, data: { type: "start", label: "Start" } },
        {
          id: "wait",
          type: "action",
          position: { x: 330, y: 80 },
          data: {
            type: "desktop_wait_for_image",
            label: "Wait Invoice Screen",
            imagePath: "/app/recordings/invoice-screen.png",
            timeoutMs: 12000
          }
        },
        {
          id: "type",
          type: "action",
          position: { x: 580, y: 80 },
          data: { type: "desktop_type", label: "Type Invoice Number", value: "{{invoiceNumber}}" }
        },
        {
          id: "click-submit",
          type: "action",
          position: { x: 830, y: 80 },
          data: {
            type: "desktop_click_image",
            label: "Click Submit",
            imagePath: "/app/recordings/submit-btn.png",
            confidence: 0.85
          }
        }
      ],
      edges: [
        { id: "e1", source: "start", target: "wait" },
        { id: "e2", source: "wait", target: "type" },
        { id: "e3", source: "type", target: "click-submit" }
      ],
      execution: executionDefaults
    }
  }
];

export function listWorkflowTemplates() {
  return templates.map((template) => ({
    id: template.id,
    name: template.name,
    description: template.description,
    category: template.category,
    difficulty: template.difficulty,
    useCase: template.useCase,
    tags: template.tags,
    nodes: Array.isArray((template.definition as any)?.nodes) ? (template.definition as any).nodes.length : 0
  }));
}

export function getWorkflowTemplate(templateId: string) {
  return templates.find((template) => template.id === templateId) || null;
}
