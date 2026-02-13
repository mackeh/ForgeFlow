import test from "node:test";
import assert from "node:assert/strict";
import { listActivities } from "./activities.js";

test("listActivities exposes summary counts and target size", () => {
  const catalog = listActivities();
  assert.equal(catalog.targetLibrarySize, 300);
  assert.ok(catalog.currentTotal >= 30);
  assert.ok(catalog.availableCount > 0);
  assert.ok(catalog.plannedCount > 0);
  assert.ok(catalog.byCategory.Core >= 1);
});
