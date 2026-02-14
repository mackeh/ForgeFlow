export type WorkflowTemplate = {
  id: string;
  name: string;
  description: string;
  category: string;
  difficulty: "starter" | "intermediate" | "advanced";
  useCase: string;
  tags: string[];
  setup?: TemplateSetupGuide;
  definition: Record<string, unknown>;
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

const executionDefaults = {
  globalTimeoutMs: 1800000,
  defaultRetries: 2,
  defaultNodeTimeoutMs: 30000
};

const templates: WorkflowTemplate[] = [
  {
    id: "invoice-intake-approval",
    name: "Invoice Intake + Approval",
    description: "Extract invoice fields, validate risk, route high-value invoices to approval, then sync.",
    category: "operations",
    difficulty: "intermediate",
    useCase: "Invoice capture and governance workflow with human oversight.",
    tags: ["invoice", "document", "approval", "integration"],
    setup: {
      requiredInputs: [
        {
          id: "finance_api",
          label: "Finance integration profile",
          kind: "integration",
          required: true,
          defaultValue: "finance_api",
          help: "Create an integration profile used by the sync node."
        },
        {
          id: "approval_threshold",
          label: "Approval threshold amount",
          kind: "text",
          required: true,
          defaultValue: "10000",
          placeholder: "10000"
        },
        {
          id: "invoice_fields",
          label: "Required invoice fields",
          kind: "text",
          required: true,
          defaultValue: "invoice_number,vendor,total,due_date,currency"
        }
      ],
      connectionChecks: [
        { id: "invoice-preflight", label: "Template preflight readiness", type: "preflight" },
        { id: "invoice-finance-integration", label: "Finance integration exists", type: "integration", integrationId: "finance_api" }
      ],
      sampleInput: {
        invoiceRawText: "Invoice Number: INV-2026-0042\nVendor: Example AB\nTotal: 12850.00\nCurrency: USD\nDue Date: 2026-03-01"
      },
      runbook: [
        "Replace sample invoice text with source data from your intake channel.",
        "Confirm approval policy/threshold before publishing.",
        "Run in test mode once and verify sync payload."
      ]
    },
    definition: {
      nodes: [
        { id: "start", type: "action", position: { x: 80, y: 80 }, data: { type: "start", label: "Start" } },
        {
          id: "load-doc",
          type: "action",
          position: { x: 330, y: 80 },
          data: {
            type: "set_variable",
            label: "Set Invoice Text",
            key: "invoiceRawText",
            value: "Invoice Number: INV-1001\nVendor: Example AB\nTotal: 12850.00\nCurrency: USD\nDue Date: 2026-03-01"
          }
        },
        {
          id: "understand",
          type: "action",
          position: { x: 580, y: 80 },
          data: {
            type: "document_understanding",
            label: "Extract Invoice Fields",
            inputKey: "invoiceRawText",
            outputKey: "invoiceDoc",
            expectedFields: ["invoice_number", "vendor", "total", "due_date", "currency"]
          }
        },
        {
          id: "normalize",
          type: "action",
          position: { x: 830, y: 80 },
          data: {
            type: "transform_llm",
            label: "Normalize Invoice Payload",
            inputKey: "invoiceDoc",
            outputKey: "invoicePayload",
            strictJson: true
          }
        },
        {
          id: "guard",
          type: "action",
          position: { x: 1080, y: 80 },
          data: {
            type: "submit_guard",
            label: "Validate Required Fields",
            inputKey: "invoicePayload",
            schema: {
              type: "object",
              required: ["invoice_number", "vendor", "total"],
              properties: {
                invoice_number: { type: "string", minLength: 1 },
                vendor: { type: "string", minLength: 1 },
                total: { type: "number" }
              }
            }
          }
        },
        {
          id: "amount",
          type: "action",
          position: { x: 1330, y: 80 },
          data: {
            type: "transform_llm",
            label: "Extract Invoice Amount",
            inputKey: "invoicePayload",
            outputKey: "invoiceAmount",
            strictJson: false,
            prompt: "Return only the numeric invoice total as plain text."
          }
        },
        {
          id: "branch",
          type: "action",
          position: { x: 1580, y: 80 },
          data: {
            type: "conditional_branch",
            label: "Amount > {{setup.approval_threshold}}?",
            inputKey: "invoiceAmount",
            operator: "gt",
            right: "{{setup.approval_threshold}}",
            trueTarget: "approval",
            falseTarget: "sync"
          }
        },
        {
          id: "approval",
          type: "action",
          position: { x: 1830, y: 20 },
          data: {
            type: "manual_approval",
            label: "Manager Approval",
            message: "Approve high-value invoice before sync."
          }
        },
        {
          id: "sync",
          type: "action",
          position: { x: 1830, y: 140 },
          data: {
            type: "integration_request",
            label: "Sync to Finance System",
            integrationId: "{{setup.finance_api}}",
            method: "POST",
            path: "/invoices",
            body: {
              invoice: "{{invoicePayload}}"
            },
            saveAs: "syncResponse"
          }
        }
      ],
      edges: [
        { id: "e1", source: "start", target: "load-doc" },
        { id: "e2", source: "load-doc", target: "understand" },
        { id: "e3", source: "understand", target: "normalize" },
        { id: "e4", source: "normalize", target: "guard" },
        { id: "e5", source: "guard", target: "amount" },
        { id: "e6", source: "amount", target: "branch" },
        { id: "e7", source: "branch", target: "approval" },
        { id: "e8", source: "branch", target: "sync" },
        { id: "e9", source: "approval", target: "sync" }
      ],
      execution: executionDefaults
    }
  },
  {
    id: "web-scrape-api-sync",
    name: "Web Scrape -> API Sync",
    description: "Scrape rows from a portal, normalize to schema, and sync downstream API.",
    category: "web",
    difficulty: "intermediate",
    useCase: "Move structured data from browser UI into backend systems.",
    tags: ["scrape", "playwright", "api", "sync"],
    setup: {
      requiredInputs: [
        {
          id: "source_url",
          label: "Source portal URL",
          kind: "url",
          required: true,
          defaultValue: "https://example.com/reports/orders"
        },
        {
          id: "table_selector",
          label: "Table selector",
          kind: "selector",
          required: true,
          defaultValue: "table tbody"
        },
        {
          id: "target_api_url",
          label: "Target API URL",
          kind: "url",
          required: true,
          defaultValue: "https://example.com/api/order-sync"
        }
      ],
      connectionChecks: [{ id: "web-sync-preflight", label: "Template preflight readiness", type: "preflight" }],
      sampleInput: {
        source: "orders-report",
        trigger: "manual"
      },
      runbook: [
        "Update selectors against the live page before running unattended.",
        "Confirm API auth and request body schema.",
        "Run once in test mode and inspect extracted rows."
      ]
    },
    definition: {
      nodes: [
        { id: "start", type: "action", position: { x: 80, y: 80 }, data: { type: "start", label: "Start" } },
        {
          id: "navigate",
          type: "action",
          position: { x: 330, y: 80 },
          data: { type: "playwright_navigate", label: "Open Source Portal", url: "{{setup.source_url}}" }
        },
        {
          id: "extract",
          type: "action",
          position: { x: 580, y: 80 },
          data: {
            type: "playwright_extract",
            label: "Extract Table Data",
            selector: "{{setup.table_selector}}",
            saveAs: "rawRows"
          }
        },
        {
          id: "normalize",
          type: "action",
          position: { x: 830, y: 80 },
          data: {
            type: "transform_llm",
            label: "Normalize Rows",
            inputKey: "rawRows",
            outputKey: "cleanRows",
            strictJson: true
          }
        },
        {
          id: "guard",
          type: "action",
          position: { x: 1080, y: 80 },
          data: {
            type: "submit_guard",
            label: "Validate Row Shape",
            inputKey: "cleanRows",
            schema: {
              type: "array",
              minItems: 1
            }
          }
        },
        {
          id: "sync",
          type: "action",
          position: { x: 1330, y: 80 },
          data: {
            type: "http_request",
            label: "POST Rows",
            method: "POST",
            url: "{{setup.target_api_url}}",
            body: { rows: "{{cleanRows}}" },
            saveAs: "syncResult"
          }
        }
      ],
      edges: [
        { id: "e1", source: "start", target: "navigate" },
        { id: "e2", source: "navigate", target: "extract" },
        { id: "e3", source: "extract", target: "normalize" },
        { id: "e4", source: "normalize", target: "guard" },
        { id: "e5", source: "guard", target: "sync" }
      ],
      execution: executionDefaults
    }
  },
  {
    id: "csv-cleanup-validation",
    name: "CSV Cleanup + Validation",
    description: "Import CSV rows, normalize records with AI, validate, and export to API.",
    category: "data",
    difficulty: "starter",
    useCase: "Prepare spreadsheet exports for reliable downstream ingestion.",
    tags: ["csv", "cleanup", "validation", "etl"],
    setup: {
      requiredInputs: [
        {
          id: "csv_schema",
          label: "Expected CSV columns",
          kind: "text",
          required: true,
          defaultValue: "id,email,total"
        },
        {
          id: "import_api_url",
          label: "Import API URL",
          kind: "url",
          required: true,
          defaultValue: "https://example.com/api/csv-import"
        }
      ],
      connectionChecks: [{ id: "csv-preflight", label: "Template preflight readiness", type: "preflight" }],
      sampleInput: {
        csvText: "id,email,total\n1,alice@example.com,120.50\n2,bob@example.com,94.00"
      },
      runbook: [
        "Replace starter CSV rows with representative production samples.",
        "Extend validation schema to include required business fields.",
        "Run in test mode and confirm rejected-row handling."
      ]
    },
    definition: {
      nodes: [
        { id: "start", type: "action", position: { x: 80, y: 80 }, data: { type: "start", label: "Start" } },
        {
          id: "import",
          type: "action",
          position: { x: 330, y: 80 },
          data: {
            type: "data_import_csv",
            label: "Import CSV",
            text: "id,email,total\n1,alice@example.com,120.50\n2,bob@example.com,94.00",
            outputKey: "csvRows"
          }
        },
        {
          id: "clean",
          type: "action",
          position: { x: 580, y: 80 },
          data: {
            type: "transform_llm",
            label: "Normalize CSV Rows",
            inputKey: "csvRows",
            outputKey: "normalizedRows",
            strictJson: true
          }
        },
        {
          id: "validate",
          type: "action",
          position: { x: 830, y: 80 },
          data: {
            type: "submit_guard",
            label: "Validate CSV Output",
            inputKey: "normalizedRows",
            schema: {
              type: "array",
              minItems: 1
            }
          }
        },
        {
          id: "send",
          type: "action",
          position: { x: 1080, y: 80 },
          data: {
            type: "http_request",
            label: "Send to Import API",
            method: "POST",
            url: "{{setup.import_api_url}}",
            body: { rows: "{{normalizedRows}}" },
            saveAs: "importResult"
          }
        }
      ],
      edges: [
        { id: "e1", source: "start", target: "import" },
        { id: "e2", source: "import", target: "clean" },
        { id: "e3", source: "clean", target: "validate" },
        { id: "e4", source: "validate", target: "send" }
      ],
      execution: executionDefaults
    }
  },
  {
    id: "email-triage-ticket-create",
    name: "Email Triage -> Ticket Create",
    description: "Classify inbound email content, route urgent cases to approval, then create support ticket.",
    category: "operations",
    difficulty: "intermediate",
    useCase: "Convert inbox workload into structured ticket operations.",
    tags: ["email", "triage", "ticketing", "approval"],
    setup: {
      requiredInputs: [
        {
          id: "helpdesk_api",
          label: "Helpdesk integration profile",
          kind: "integration",
          required: true,
          defaultValue: "helpdesk_api"
        },
        {
          id: "priority_labels",
          label: "Priority labels",
          kind: "text",
          required: true,
          defaultValue: "high,medium,low"
        }
      ],
      connectionChecks: [
        { id: "email-preflight", label: "Template preflight readiness", type: "preflight" },
        { id: "email-helpdesk-integration", label: "Helpdesk integration exists", type: "integration", integrationId: "helpdesk_api" }
      ],
      sampleInput: {
        emailBody: "Subject: Unable to process payroll export\nPriority: high\nBody: payroll API returns 500 for 3 hours."
      },
      runbook: [
        "Tune triage prompt for your support taxonomy.",
        "Map ticket payload fields to your destination system.",
        "Run test mode and verify approval path for high priority."
      ]
    },
    definition: {
      nodes: [
        { id: "start", type: "action", position: { x: 80, y: 80 }, data: { type: "start", label: "Start" } },
        {
          id: "email",
          type: "action",
          position: { x: 330, y: 80 },
          data: {
            type: "set_variable",
            label: "Set Email Body",
            key: "emailBody",
            value:
              "Subject: Unable to process payroll export\\nPriority: high\\nBody: payroll API returns 500 for 3 hours."
          }
        },
        {
          id: "priority",
          type: "action",
          position: { x: 580, y: 80 },
          data: {
            type: "transform_llm",
            label: "Derive Ticket Priority",
            inputKey: "emailBody",
            outputKey: "ticketPriority",
            strictJson: false,
            prompt: "Return only one word priority: high, medium, or low."
          }
        },
        {
          id: "summary",
          type: "action",
          position: { x: 830, y: 80 },
          data: {
            type: "transform_llm",
            label: "Summarize Issue",
            inputKey: "emailBody",
            outputKey: "ticketSummary",
            strictJson: false,
            prompt: "Return one short support ticket summary sentence."
          }
        },
        {
          id: "branch",
          type: "action",
          position: { x: 1080, y: 80 },
          data: {
            type: "conditional_branch",
            label: "High Priority?",
            inputKey: "ticketPriority",
            operator: "eq",
            right: "high",
            trueTarget: "approval",
            falseTarget: "ticket"
          }
        },
        {
          id: "approval",
          type: "action",
          position: { x: 1330, y: 20 },
          data: {
            type: "manual_approval",
            label: "Ops Lead Approval",
            message: "Approve high-priority ticket creation."
          }
        },
        {
          id: "ticket",
          type: "action",
          position: { x: 1330, y: 140 },
          data: {
            type: "integration_request",
            label: "Create Ticket",
            integrationId: "{{setup.helpdesk_api}}",
            method: "POST",
            path: "/tickets",
            body: {
              summary: "{{ticketSummary}}",
              priority: "{{ticketPriority}}",
              details: "{{emailBody}}"
            },
            saveAs: "ticketResponse"
          }
        }
      ],
      edges: [
        { id: "e1", source: "start", target: "email" },
        { id: "e2", source: "email", target: "priority" },
        { id: "e3", source: "priority", target: "summary" },
        { id: "e4", source: "summary", target: "branch" },
        { id: "e5", source: "branch", target: "approval" },
        { id: "e6", source: "branch", target: "ticket" },
        { id: "e7", source: "approval", target: "ticket" }
      ],
      execution: executionDefaults
    }
  },
  {
    id: "scheduled-health-check-alert",
    name: "Scheduled Health-Check + Alert",
    description: "Run a health probe, score service state, and trigger alert webhook for degraded state.",
    category: "operations",
    difficulty: "starter",
    useCase: "Operational monitoring workflow for scheduled execution.",
    tags: ["health-check", "alerting", "ops", "schedule"],
    setup: {
      requiredInputs: [
        {
          id: "health_url",
          label: "Health endpoint URL",
          kind: "url",
          required: true,
          defaultValue: "https://example.com/health"
        },
        {
          id: "alert_webhook",
          label: "Alert webhook URL",
          kind: "url",
          required: true,
          defaultValue: "https://example.com/webhooks/alerts"
        }
      ],
      connectionChecks: [{ id: "health-preflight", label: "Template preflight readiness", type: "preflight" }],
      sampleInput: {
        source: "scheduled-health-check"
      },
      runbook: [
        "Attach this workflow to a schedule preset before enabling unattended mode.",
        "Verify alert endpoint ownership and retry policy.",
        "Run a simulated degraded response to validate routing."
      ]
    },
    definition: {
      nodes: [
        { id: "start", type: "action", position: { x: 80, y: 80 }, data: { type: "start", label: "Start" } },
        {
          id: "check",
          type: "action",
          position: { x: 330, y: 80 },
          data: {
            type: "http_request",
            label: "Call Health Endpoint",
            method: "GET",
            url: "{{setup.health_url}}",
            saveAs: "healthPayload"
          }
        },
        {
          id: "classify",
          type: "action",
          position: { x: 580, y: 80 },
          data: {
            type: "transform_llm",
            label: "Classify Health State",
            inputKey: "healthPayload",
            outputKey: "healthState",
            strictJson: false,
            prompt: "Return only one word: healthy or degraded."
          }
        },
        {
          id: "branch",
          type: "action",
          position: { x: 830, y: 80 },
          data: {
            type: "conditional_branch",
            label: "Degraded?",
            inputKey: "healthState",
            operator: "eq",
            right: "degraded",
            trueTarget: "alert",
            falseTarget: "ok"
          }
        },
        {
          id: "alert",
          type: "action",
          position: { x: 1080, y: 20 },
          data: {
            type: "http_request",
            label: "Send Alert",
            method: "POST",
            url: "{{setup.alert_webhook}}",
            body: {
              service: "forgeflow",
              status: "{{healthState}}",
              payload: "{{healthPayload}}"
            },
            saveAs: "alertResult"
          }
        },
        {
          id: "ok",
          type: "action",
          position: { x: 1080, y: 140 },
          data: {
            type: "set_variable",
            label: "Mark Healthy",
            key: "alertResult",
            value: "no-alert-required"
          }
        }
      ],
      edges: [
        { id: "e1", source: "start", target: "check" },
        { id: "e2", source: "check", target: "classify" },
        { id: "e3", source: "classify", target: "branch" },
        { id: "e4", source: "branch", target: "alert" },
        { id: "e5", source: "branch", target: "ok" }
      ],
      execution: executionDefaults
    }
  },
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

function sanitizeId(input: string) {
  return input.replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
}

function inferTemplateSetup(template: WorkflowTemplate): TemplateSetupGuide {
  const nodes = Array.isArray((template.definition as any)?.nodes) ? ((template.definition as any).nodes as Array<Record<string, any>>) : [];
  const integrationIds = new Set<string>();
  const placeholders = new Set<string>();

  const collect = (value: unknown) => {
    if (typeof value === "string") {
      for (const match of value.matchAll(/{{\s*([a-zA-Z0-9_.-]+)\s*}}/g)) {
        if (match[1]) placeholders.add(match[1]);
      }
      return;
    }
    if (Array.isArray(value)) {
      for (const item of value) collect(item);
      return;
    }
    if (value && typeof value === "object") {
      for (const nested of Object.values(value as Record<string, unknown>)) collect(nested);
    }
  };

  for (const node of nodes) {
    const data = node?.data as Record<string, unknown> | undefined;
    if (!data) continue;
    const integrationId = typeof data.integrationId === "string" ? data.integrationId.trim() : "";
    if (integrationId) integrationIds.add(integrationId);
    collect(data);
  }

  const requiredInputs: TemplateSetupField[] = [
    ...Array.from(integrationIds).map((integrationId) => ({
      id: `integration-${sanitizeId(integrationId)}`,
      label: `Integration profile: ${integrationId}`,
      kind: "integration" as const,
      required: true,
      defaultValue: integrationId
    })),
    ...Array.from(placeholders)
      .slice(0, 3)
      .map((key) => ({
        id: `input-${sanitizeId(key)}`,
        label: `Input value: ${key}`,
        kind: "text" as const,
        required: false,
        placeholder: `sample-${key}`
      }))
  ];
  if (!requiredInputs.length) {
    requiredInputs.push({
      id: "review-notes",
      label: "Template review notes",
      kind: "text",
      required: false,
      placeholder: "record any selector/endpoint adjustments before first run"
    });
  }

  const sampleInput = Array.from(placeholders)
    .slice(0, 5)
    .reduce<Record<string, unknown>>((acc, key) => {
      acc[key] = `sample-${key}`;
      return acc;
    }, {});

  return {
    requiredInputs,
    connectionChecks: [
      { id: `${template.id}-preflight`, label: "Template preflight readiness", type: "preflight" },
      ...Array.from(integrationIds).map((integrationId) => ({
        id: `${template.id}-integration-${sanitizeId(integrationId)}`,
        label: `Integration exists: ${integrationId}`,
        type: "integration" as const,
        integrationId
      }))
    ],
    sampleInput: Object.keys(sampleInput).length ? sampleInput : { source: "demo" },
    runbook: [
      "Fill required setup values before first run.",
      "Run in test mode and inspect logs/context outputs.",
      "Publish only after successful test validation."
    ]
  };
}

function withResolvedSetup(template: WorkflowTemplate): WorkflowTemplate & { setup: TemplateSetupGuide } {
  return {
    ...template,
    setup: template.setup || inferTemplateSetup(template)
  };
}

function mergeTemplateSetupValues(setup: TemplateSetupGuide, overrides?: Record<string, unknown>) {
  const merged: Record<string, unknown> = {};
  for (const field of setup.requiredInputs || []) {
    if (field.defaultValue !== undefined) {
      merged[field.id] = field.defaultValue;
    }
  }
  for (const [key, value] of Object.entries(overrides || {})) {
    if (value === undefined || value === null) continue;
    if (typeof value === "string" && value.trim().length === 0) continue;
    merged[key] = value;
  }
  return merged;
}

function applySetupPlaceholders(value: unknown, setupValues: Record<string, unknown>): unknown {
  if (typeof value === "string") {
    const fullMatch = value.match(/^{{\s*setup\.([a-zA-Z0-9_-]+)\s*}}$/);
    if (fullMatch?.[1]) {
      const resolved = setupValues[fullMatch[1]];
      return resolved !== undefined ? resolved : value;
    }
    return value.replace(/{{\s*setup\.([a-zA-Z0-9_-]+)\s*}}/g, (_all, key: string) => {
      const resolved = setupValues[key];
      return resolved === undefined ? "" : String(resolved);
    });
  }
  if (Array.isArray(value)) {
    return value.map((item) => applySetupPlaceholders(item, setupValues));
  }
  if (value && typeof value === "object") {
    const next: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      next[key] = applySetupPlaceholders(nested, setupValues);
    }
    return next;
  }
  return value;
}

export function renderWorkflowTemplateDefinition(template: WorkflowTemplate & { setup: TemplateSetupGuide }, setupValues?: Record<string, unknown>) {
  const mergedSetupValues = mergeTemplateSetupValues(template.setup, setupValues);
  return applySetupPlaceholders(template.definition, mergedSetupValues) as Record<string, unknown>;
}

export function listWorkflowTemplateDefinitions() {
  return templates.map((template) => withResolvedSetup(template));
}

export function listWorkflowTemplates() {
  return listWorkflowTemplateDefinitions().map((template) => ({
    id: template.id,
    name: template.name,
    description: template.description,
    category: template.category,
    difficulty: template.difficulty,
    useCase: template.useCase,
    tags: template.tags,
    setup: template.setup,
    nodes: Array.isArray((template.definition as any)?.nodes) ? (template.definition as any).nodes.length : 0
  }));
}

export function getWorkflowTemplate(templateId: string) {
  const template = templates.find((item) => item.id === templateId);
  return template ? withResolvedSetup(template) : null;
}
