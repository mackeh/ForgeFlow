import test from "node:test";
import assert from "node:assert/strict";
import { buildAutopilotPlan } from "./autopilot.js";

test("buildAutopilotPlan generates web + api + ai chain from natural language prompt", () => {
  const plan = buildAutopilotPlan("Open website, scrape table data, clean with AI, and send via API");
  const nodeTypes = plan.definition.nodes.map((node) => String(node.data?.type || ""));
  assert.ok(nodeTypes.includes("playwright_navigate"));
  assert.ok(nodeTypes.includes("playwright_extract"));
  assert.ok(nodeTypes.includes("transform_llm"));
  assert.ok(nodeTypes.includes("http_request"));
  assert.equal(plan.definition.edges.length, plan.definition.nodes.length - 1);
  assert.ok(plan.confidence > 0.6);
  assert.equal(plan.requiresConfirmation, true);
  assert.ok(plan.nodeInsights.some((insight) => insight.nodeType === "http_request"));
});

test("buildAutopilotPlan falls back to starter workflow for vague prompts", () => {
  const plan = buildAutopilotPlan("do stuff");
  const nodeTypes = plan.definition.nodes.map((node) => String(node.data?.type || ""));
  assert.ok(nodeTypes.length >= 4);
  assert.ok(plan.fallbackUsed);
  assert.ok(Boolean(plan.fallbackTemplateId));
  assert.ok(plan.warnings.some((warning) => warning.toLowerCase().includes("starter template")));
  assert.ok(plan.fallbackOptions.length >= 3);
});

test("buildAutopilotPlan returns warnings for planned feature areas", () => {
  const plan = buildAutopilotPlan("process SAP invoice PDF with clipboard ai");
  assert.ok(plan.warnings.length >= 2);
});

test("buildAutopilotPlan includes per-node warnings for placeholder heavy steps", () => {
  const plan = buildAutopilotPlan("simple web workflow");
  const navigateInsight = plan.nodeInsights.find((insight) => insight.nodeType === "playwright_navigate");
  assert.ok(navigateInsight);
  assert.ok(typeof navigateInsight?.confidence === "number");
});
