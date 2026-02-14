import test from "node:test";
import assert from "node:assert/strict";
import { getWorkflowTemplate, listWorkflowTemplates } from "./templates.js";

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
});

test("getWorkflowTemplate returns full definition for known template", () => {
  const template = getWorkflowTemplate("web-scrape-api-sync");
  assert.ok(template);
  assert.equal(template?.name, "Web Scrape -> API Sync");
  assert.equal(Array.isArray((template?.definition as any).nodes), true);
});
