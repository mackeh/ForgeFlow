import test from "node:test";
import assert from "node:assert/strict";
import { validateAllWorkflowTemplates } from "./templateQuality.js";

test("all workflow templates pass quality gate checks", () => {
  const report = validateAllWorkflowTemplates();
  const failing = report.filter((item) => item.errors.length > 0);
  assert.equal(failing.length, 0, failing.map((item) => `${item.templateId}: ${item.errors.join(" | ")}`).join("\n"));
});
