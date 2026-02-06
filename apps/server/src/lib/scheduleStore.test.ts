import test from "node:test";
import assert from "node:assert/strict";
import { assertValidCron, normalizeMaintenanceWindows, normalizeScheduleTimezone } from "./scheduleStore.js";

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

test("normalizeMaintenanceWindows keeps valid ranges and weekdays", () => {
  const normalized = normalizeMaintenanceWindows([
    { start: "22:00", end: "02:00", weekdays: [1, 2, 2, 7, -1] },
    { start: "not-time", end: "10:00" }
  ]);
  assert.ok(normalized);
  assert.equal(normalized?.length, 1);
  assert.equal(normalized?.[0].start, "22:00");
  assert.equal(normalized?.[0].end, "02:00");
  assert.deepEqual(normalized?.[0].weekdays, [1, 2]);
});
