import { useEffect, useState } from "react";
import type { Node } from "reactflow";
import { API_URL } from "../api";
import { imagePathToUrl } from "../utils";

type QuickField = {
  key: string;
  label: string;
  type?: "text" | "number" | "select";
  options?: Array<{ label: string; value: string }>;
};

function quickFieldsForType(nodeType: string): QuickField[] {
  switch (nodeType) {
    case "set_variable":
      return [
        { key: "key", label: "Key" },
        { key: "value", label: "Value" }
      ];
    case "http_request":
      return [
        { key: "url", label: "URL" },
        {
          key: "method",
          label: "Method",
          type: "select",
          options: [
            { label: "GET", value: "GET" },
            { label: "POST", value: "POST" },
            { label: "PUT", value: "PUT" },
            { label: "PATCH", value: "PATCH" },
            { label: "DELETE", value: "DELETE" }
          ]
        },
        { key: "saveAs", label: "Save As" }
      ];
    case "playwright_navigate":
      return [{ key: "url", label: "URL" }];
    case "playwright_click":
      return [
        { key: "selector", label: "Selector" },
        { key: "textHint", label: "Text Hint" },
        { key: "testId", label: "Test ID" },
        { key: "ariaLabel", label: "Aria Label" },
        { key: "xpath", label: "XPath" },
        { key: "selectorModel", label: "Selector AI Model" }
      ];
    case "playwright_fill":
      return [
        { key: "selector", label: "Selector" },
        { key: "value", label: "Value" },
        { key: "textHint", label: "Text Hint" },
        { key: "testId", label: "Test ID" },
        { key: "ariaLabel", label: "Aria Label" },
        { key: "xpath", label: "XPath" },
        { key: "selectorModel", label: "Selector AI Model" }
      ];
    case "playwright_extract":
      return [
        { key: "selector", label: "Selector" },
        { key: "saveAs", label: "Save As" },
        { key: "textHint", label: "Text Hint" },
        { key: "testId", label: "Test ID" },
        { key: "ariaLabel", label: "Aria Label" },
        { key: "xpath", label: "XPath" },
        { key: "selectorModel", label: "Selector AI Model" }
      ];
    case "playwright_visual_assert":
      return [
        { key: "baselineName", label: "Baseline Name" },
        { key: "selector", label: "Selector (optional)" },
        { key: "thresholdPct", label: "Threshold %", type: "number" },
        {
          key: "autoCreateBaseline",
          label: "Auto Create Baseline",
          type: "select",
          options: [
            { label: "True", value: "true" },
            { label: "False", value: "false" }
          ]
        },
        { key: "outputKey", label: "Output Key" }
      ];
    case "transform_llm":
      return [
        { key: "inputKey", label: "Input Key" },
        { key: "outputKey", label: "Output Key" },
        { key: "model", label: "Model" }
      ];
    case "validate_record":
    case "submit_guard":
      return [{ key: "inputKey", label: "Input Key" }];
    case "manual_approval":
      return [
        { key: "message", label: "Message" },
        {
          key: "autoApproveInTestMode",
          label: "Auto Approve (Test)",
          type: "select",
          options: [
            { label: "True", value: "true" },
            { label: "False", value: "false" }
          ]
        }
      ];
    case "conditional_branch":
      return [
        { key: "inputKey", label: "Input Key" },
        {
          key: "operator",
          label: "Operator",
          type: "select",
          options: [
            { label: "truthy", value: "truthy" },
            { label: "falsy", value: "falsy" },
            { label: "eq", value: "eq" },
            { label: "ne", value: "ne" },
            { label: "gt", value: "gt" },
            { label: "gte", value: "gte" },
            { label: "lt", value: "lt" },
            { label: "lte", value: "lte" },
            { label: "contains", value: "contains" },
            { label: "in", value: "in" }
          ]
        },
        { key: "right", label: "Right Value" },
        { key: "trueTarget", label: "True Target Node ID" },
        { key: "falseTarget", label: "False Target Node ID" },
        { key: "outputKey", label: "Output Key" }
      ];
    case "loop_iterate":
      return [
        { key: "inputKey", label: "Input Array Key" },
        { key: "itemKey", label: "Item Key" },
        { key: "indexKey", label: "Index Key" },
        { key: "outputKey", label: "Output Key" },
        { key: "taskTimeoutMs", label: "Task Timeout (ms)", type: "number" },
        {
          key: "allowPartial",
          label: "Allow Partial Failures",
          type: "select",
          options: [
            { label: "False", value: "false" },
            { label: "True", value: "true" }
          ]
        }
      ];
    case "parallel_execute":
      return [
        { key: "outputKey", label: "Output Key" },
        { key: "taskTimeoutMs", label: "Task Timeout (ms)", type: "number" },
        {
          key: "allowPartial",
          label: "Allow Partial Success",
          type: "select",
          options: [
            { label: "False", value: "false" },
            { label: "True", value: "true" }
          ]
        }
      ];
    case "data_import_csv":
      return [
        { key: "filePath", label: "CSV File Path" },
        { key: "text", label: "CSV Text (optional)" },
        { key: "outputKey", label: "Output Key" }
      ];
    case "integration_request":
      return [
        { key: "integrationId", label: "Integration ID" },
        { key: "method", label: "Method" },
        { key: "path", label: "Path" },
        { key: "url", label: "URL (optional override)" },
        { key: "saveAs", label: "Save As" }
      ];
    case "desktop_click_image":
      return [
        { key: "imagePath", label: "Image Path" },
        { key: "confidence", label: "Confidence", type: "number" }
      ];
    case "desktop_type":
      return [{ key: "value", label: "Value" }];
    case "desktop_wait_for_image":
      return [
        { key: "imagePath", label: "Image Path" },
        { key: "timeoutMs", label: "Timeout (ms)", type: "number" }
      ];
    default:
      return [];
  }
}

function parseDataOrFallback(rawJson: string, fallback: Record<string, unknown>) {
  try {
    const parsed = JSON.parse(rawJson);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // Keep fallback when JSON is mid-edit and invalid.
  }
  return { ...fallback };
}

function coerceFieldValue(field: QuickField, value: string) {
  if (field.type === "number") {
    const num = Number(value);
    return Number.isFinite(num) ? num : value;
  }
  if (
    field.key === "autoApproveInTestMode" ||
    field.key === "allowPartial" ||
    field.key === "autoCreateBaseline"
  ) {
    return value === "true";
  }
  return value;
}

type OnUpdateNodes = (updater: (nodes: Node[]) => Node[]) => void;

export function Inspector({ node, onUpdate }: { node: Node | null; onUpdate: OnUpdateNodes }) {
  const [json, setJson] = useState("");

  useEffect(() => {
    if (!node) {
      setJson("");
      return;
    }
    setJson(JSON.stringify(node.data, null, 2));
  }, [node]);

  if (!node) {
    return (
      <aside className="inspector">
        <h2>Inspector</h2>
        <p>Select a node to edit its settings.</p>
      </aside>
    );
  }

  const previewUrl =
    node.data?.type === "desktop_click_image" ? imagePathToUrl(API_URL, node.data?.imagePath) : null;
  const nodeType = String(node.data?.type || "");
  const quickFields = quickFieldsForType(nodeType);

  return (
    <aside className="inspector">
      <h2>Inspector</h2>
      <div className="inspector-body">
        <label>Node ID</label>
        <div className="readonly">{node.id}</div>
        {quickFields.length ? (
          <>
            <label>Quick Edit</label>
            <div className="inspector-form">
              {quickFields.map((field) => {
                const base = parseDataOrFallback(json, (node.data || {}) as Record<string, unknown>);
                const rawValue = base[field.key];
                const value = rawValue === undefined || rawValue === null ? "" : String(rawValue);
                if (field.type === "select" && field.options) {
                  return (
                    <div key={field.key} className="inspector-field">
                      <span>{field.label}</span>
                      <select
                        value={value}
                        onChange={(e) => {
                          const next = parseDataOrFallback(json, (node.data || {}) as Record<string, unknown>);
                          next[field.key] = coerceFieldValue(field, e.target.value);
                          setJson(JSON.stringify(next, null, 2));
                        }}
                      >
                        {field.options.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  );
                }
                return (
                  <div key={field.key} className="inspector-field">
                    <span>{field.label}</span>
                    <input
                      type={field.type === "number" ? "number" : "text"}
                      value={value}
                      onChange={(e) => {
                        const next = parseDataOrFallback(json, (node.data || {}) as Record<string, unknown>);
                        next[field.key] = coerceFieldValue(field, e.target.value);
                        setJson(JSON.stringify(next, null, 2));
                      }}
                    />
                  </div>
                );
              })}
            </div>
          </>
        ) : null}
        {previewUrl ? (
          <>
            <label>Target Preview</label>
            <img className="inspector-thumb" src={previewUrl} alt="Target preview" />
          </>
        ) : null}
        <label>Data</label>
        <textarea
          value={json}
          onChange={(e) => setJson(e.target.value)}
          onKeyDown={(e) => e.stopPropagation()}
          onKeyUp={(e) => e.stopPropagation()}
          onFocus={(e) => e.currentTarget.select()}
          rows={16}
        />
        <button
          onClick={() => {
            try {
              const next = JSON.parse(json);
              onUpdate((nodes: Node[]) =>
                nodes.map((n) => (n.id === node.id ? { ...n, data: next } : n))
              );
            } catch {
              alert("Invalid JSON");
            }
          }}
        >
          Apply
        </button>
      </div>
    </aside>
  );
}
