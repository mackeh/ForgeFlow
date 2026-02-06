import test from "node:test";
import assert from "node:assert/strict";
import { assertValidCron, normalizeScheduleTimezone } from "./scheduleStore.js";

test("normalizeScheduleTimezone keeps valid timezone and falls back for invalid values", () => {
  assert.equal(normalizeScheduleTimezone("Europe/Stockholm"), "Europe/Stockholm");
  const fallback = normalizeScheduleTimezone("Definitely/Invalid");
  assert.equal(typeof fallback, "string");
  assert.equal(fallback.length > 0, true);
});

test("assertValidCron validates cron expression format", () => {
  assert.doesNotThrow(() => assertValidCron("*/10 * * * *"));
  assert.throws(() => assertValidCron("not-a-cron"), /Invalid cron expression/);
});
