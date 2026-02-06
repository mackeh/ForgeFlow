import test from "node:test";
import assert from "node:assert/strict";
import { getWorkflowTemplate, listWorkflowTemplates } from "./templates.js";

test("listWorkflowTemplates exposes curated templates", () => {
  const templates = listWorkflowTemplates();
  assert.equal(templates.length >= 3, true);
  assert.equal(templates.some((template) => template.id === "web-form-submit"), true);
});

test("getWorkflowTemplate returns full definition for known template", () => {
  const template = getWorkflowTemplate("api-cleanup-sync");
  assert.ok(template);
  assert.equal(template?.name, "API Cleanup Sync");
  assert.equal(Array.isArray((template?.definition as any).nodes), true);
});
