export type WorkflowTemplate = {
  id: string;
  name: string;
  description: string;
  category: string;
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
    id: "api-cleanup-sync",
    name: "API Cleanup Sync",
    description: "Fetch records, clean with local LLM, validate schema, then post downstream.",
    category: "data",
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
    id: "desktop-assisted-submit",
    name: "Desktop Assisted Submit",
    description: "Use desktop image waits/clicks, type values, and require explicit approval before submit.",
    category: "desktop",
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
  }
];

export function listWorkflowTemplates() {
  return templates.map((template) => ({
    id: template.id,
    name: template.name,
    description: template.description,
    category: template.category
  }));
}

export function getWorkflowTemplate(templateId: string) {
  return templates.find((template) => template.id === templateId) || null;
}
