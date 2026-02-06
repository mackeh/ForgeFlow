import test from "node:test";
import assert from "node:assert/strict";
import { isInMaintenanceWindow, maintenanceBlockReason } from "./scheduleRules.js";

test("isInMaintenanceWindow matches simple same-day ranges", () => {
  const windows = [{ start: "09:00", end: "10:00", weekdays: [1, 2, 3, 4, 5] }];
  const inside = new Date("2026-02-06T09:30:00.000Z");
  const outside = new Date("2026-02-06T11:30:00.000Z");
  assert.equal(isInMaintenanceWindow(inside, "UTC", windows), true);
  assert.equal(isInMaintenanceWindow(outside, "UTC", windows), false);
});

test("isInMaintenanceWindow supports overnight windows", () => {
  const windows = [{ start: "22:00", end: "02:00" }];
  const insideLate = new Date("2026-02-06T23:10:00.000Z");
  const insideEarly = new Date("2026-02-06T01:40:00.000Z");
  const outside = new Date("2026-02-06T15:00:00.000Z");
  assert.equal(isInMaintenanceWindow(insideLate, "UTC", windows), true);
  assert.equal(isInMaintenanceWindow(insideEarly, "UTC", windows), true);
  assert.equal(isInMaintenanceWindow(outside, "UTC", windows), false);
});

test("maintenanceBlockReason reports skip message when blocked", () => {
  const windows = [{ start: "12:00", end: "13:00" }];
  const date = new Date("2026-02-06T12:30:00.000Z");
  assert.equal(maintenanceBlockReason(date, "UTC", windows), "Skipped due to maintenance window");
});

