import test from "node:test";
import assert from "node:assert/strict";
import { getWorkflowTemplate, listWorkflowTemplates, renderWorkflowTemplateDefinition } from "./templates.js";

test("listWorkflowTemplates exposes curated templates", () => {
  const templates = listWorkflowTemplates();
  assert.equal(templates.length >= 12, true);
  assert.equal(templates.some((template) => template.id === "invoice-intake-approval"), true);
  assert.equal(templates.some((template) => template.id === "web-scrape-api-sync"), true);
  assert.equal(templates.some((template) => template.id === "csv-cleanup-validation"), true);
  assert.equal(templates.some((template) => template.id === "email-triage-ticket-create"), true);
  assert.equal(templates.some((template) => template.id === "scheduled-health-check-alert"), true);
  assert.equal(templates.some((template) => template.id === "web-form-submit"), true);
  assert.equal(templates.some((template) => template.id === "web-table-scrape"), true);
  assert.equal(templates.some((template) => template.id === "conditional-routing"), true);
  assert.equal(templates.some((template) => template.id === "api-cleanup-sync"), true);
  assert.equal(templates.some((template) => template.id === "batch-loop-sync"), true);
  const sample = templates.find((template) => template.id === "invoice-intake-approval");
  assert.equal(typeof sample?.difficulty, "string");
  assert.equal(Array.isArray(sample?.tags), true);
  assert.equal(Array.isArray((sample as any)?.setup?.requiredInputs), true);
  assert.equal(Array.isArray((sample as any)?.setup?.connectionChecks), true);
});

test("getWorkflowTemplate returns full definition for known template", () => {
  const template = getWorkflowTemplate("web-scrape-api-sync");
  assert.ok(template);
  assert.equal(template?.name, "Web Scrape -> API Sync");
  assert.equal(Array.isArray((template?.definition as any).nodes), true);
  assert.equal(typeof (template as any)?.setup?.sampleInput, "object");
});

test("renderWorkflowTemplateDefinition injects setup values into definition placeholders", () => {
  const template = getWorkflowTemplate("web-scrape-api-sync");
  assert.ok(template);
  const definition = renderWorkflowTemplateDefinition(template!, {
    source_url: "https://portal.example.internal/orders",
    table_selector: "#orders-table tbody",
    target_api_url: "https://api.example.internal/sync"
  });
  const nodes = Array.isArray((definition as any).nodes) ? ((definition as any).nodes as any[]) : [];
  const navigate = nodes.find((node) => node.id === "navigate");
  const extract = nodes.find((node) => node.id === "extract");
  const sync = nodes.find((node) => node.id === "sync");
  assert.equal(navigate?.data?.url, "https://portal.example.internal/orders");
  assert.equal(extract?.data?.selector, "#orders-table tbody");
  assert.equal(sync?.data?.url, "https://api.example.internal/sync");
});

test("renderWorkflowTemplateDefinition keeps setup defaults when overrides are missing", () => {
  const template = getWorkflowTemplate("invoice-intake-approval");
  assert.ok(template);
  const definition = renderWorkflowTemplateDefinition(template!, {});
  const nodes = Array.isArray((definition as any).nodes) ? ((definition as any).nodes as any[]) : [];
  const branch = nodes.find((node) => node.id === "branch");
  const sync = nodes.find((node) => node.id === "sync");
  assert.equal(branch?.data?.right, "10000");
  assert.equal(sync?.data?.integrationId, "finance_api");
});
