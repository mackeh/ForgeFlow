import { describe, expect, test } from "vitest";
import {
  buildTemplateReadiness,
  buildTemplateSetupInitialValues,
  buildTemplateSetupProgress,
  integrationExists
} from "./templateSetup";

describe("template setup helpers", () => {
  const setup = {
    requiredInputs: [
      { id: "api_url", label: "API URL", kind: "url", required: true, defaultValue: "https://example.com" },
      { id: "notes", label: "Notes", kind: "text", required: false }
    ],
    connectionChecks: [
      { id: "preflight", label: "Preflight", type: "preflight" as const },
      { id: "integration", label: "Integration", type: "integration" as const, integrationId: "finance_api" }
    ],
    sampleInput: { source: "demo" },
    runbook: ["Review setup"]
  };

  test("buildTemplateSetupInitialValues maps defaults", () => {
    const values = buildTemplateSetupInitialValues(setup);
    expect(values.api_url).toBe("https://example.com");
    expect(values.notes).toBe("");
  });

  test("buildTemplateSetupProgress counts required fields", () => {
    const progress = buildTemplateSetupProgress(setup, { api_url: "  ", notes: "ok" });
    expect(progress.requiredTotal).toBe(1);
    expect(progress.requiredDone).toBe(0);
    expect(progress.requiredComplete).toBe(false);
  });

  test("integrationExists checks id and name", () => {
    expect(integrationExists("finance_api", [{ id: "finance_api" }])).toBe(true);
    expect(integrationExists("finance_api", [{ name: "finance_api" }])).toBe(true);
    expect(integrationExists("finance_api", [{ id: "other" }])).toBe(false);
  });

  test("buildTemplateReadiness requires required fields and checks", () => {
    const readiness = buildTemplateReadiness({
      setup,
      values: { api_url: "https://example.com" },
      integrations: [{ id: "finance_api" }],
      preflightReady: true
    });
    expect(readiness.ready).toBe(true);
    expect(readiness.checksReady).toBe(true);
  });
});
