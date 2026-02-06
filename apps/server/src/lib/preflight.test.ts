import test from "node:test";
import assert from "node:assert/strict";
import { preflightForDefinition, workflowNeedsDesktop, workflowNeedsWeb } from "./preflight.js";

test("workflow node capability detectors", () => {
  const def = {
    nodes: [
      { id: "1", data: { type: "playwright_click" } },
      { id: "2", data: { type: "desktop_click_image" } }
    ]
  };

  assert.equal(workflowNeedsWeb(def), true);
  assert.equal(workflowNeedsDesktop(def), true);
  assert.equal(workflowNeedsWeb({ nodes: [] }), false);
  assert.equal(workflowNeedsDesktop({ nodes: [] }), false);
});

test("preflight blocks web run when headless is false and display is unavailable", async () => {
  const result = await preflightForDefinition(
    {
      nodes: [{ id: "1", data: { type: "playwright_click" } }],
      execution: { playwrightHeadless: false }
    },
    {
      checkHealthFn: async () => true,
      hasDisplayAccessFn: async () => false
    }
  );

  assert.equal(result.ready, false);
  assert.equal(result.checks.webAutomation.state, "error");
});

test("preflight blocks desktop run when agent is unavailable", async () => {
  const result = await preflightForDefinition(
    {
      nodes: [{ id: "1", data: { type: "desktop_type" } }],
      execution: { playwrightHeadless: true }
    },
    {
      checkHealthFn: async (baseUrl, path) => {
        if (path === "/health" && baseUrl.includes("agent")) return false;
        return true;
      },
      hasDisplayAccessFn: async () => true
    }
  );

  assert.equal(result.ready, false);
  assert.equal(result.checks.desktopAutomation.state, "error");
});

test("preflight allows web run in headless mode without display", async () => {
  const result = await preflightForDefinition(
    {
      nodes: [{ id: "1", data: { type: "playwright_extract" } }],
      execution: { playwrightHeadless: true }
    },
    {
      checkHealthFn: async () => true,
      hasDisplayAccessFn: async () => false
    }
  );

  assert.equal(result.ready, true);
  assert.equal(result.checks.webAutomation.state, "ok");
});
