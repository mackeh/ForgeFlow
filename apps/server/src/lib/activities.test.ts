import test from "node:test";
import assert from "node:assert/strict";
import { listActivities } from "./activities.js";

test("listActivities exposes summary counts and target size", () => {
  const catalog = listActivities();
  assert.equal(catalog.targetLibrarySize, 300);
  assert.ok(catalog.currentTotal >= 90);
  assert.ok(catalog.availableCount > 0);
  assert.ok(catalog.plannedCount > 0);
  assert.ok(catalog.byCategory.Core >= 1);
  assert.ok(catalog.byPhase["phase-1"] > 0);
  assert.ok(catalog.byPhase["phase-2"] > 0);
  assert.ok(catalog.byPack["system-core"] > 0);
  assert.ok(Array.isArray(catalog.roadmap));
  assert.ok(catalog.roadmap.some((pack) => pack.id === "system-core"));
  assert.ok(catalog.roadmap.some((pack) => pack.id === "integration-service"));
  assert.ok(catalog.roadmap.some((pack) => pack.id === "ai-center"));
});
