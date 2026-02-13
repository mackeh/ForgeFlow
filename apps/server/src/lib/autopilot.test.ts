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
});

test("buildAutopilotPlan falls back to starter workflow for vague prompts", () => {
  const plan = buildAutopilotPlan("do stuff");
  const nodeTypes = plan.definition.nodes.map((node) => String(node.data?.type || ""));
  assert.deepEqual(nodeTypes, ["start", "set_variable"]);
  assert.ok(plan.capabilities.includes("orchestration"));
});

test("buildAutopilotPlan returns warnings for planned feature areas", () => {
  const plan = buildAutopilotPlan("process SAP invoice PDF with clipboard ai");
  assert.ok(plan.warnings.length >= 2);
});
