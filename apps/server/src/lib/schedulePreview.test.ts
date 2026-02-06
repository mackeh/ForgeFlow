import test from "node:test";
import assert from "node:assert/strict";
import { buildSchedulePreview, listSchedulePresets, nextRunAt } from "./schedulePreview.js";

test("listSchedulePresets returns built-in presets", () => {
  const presets = listSchedulePresets();
  assert.equal(Array.isArray(presets), true);
  assert.equal(presets.length > 0, true);
  assert.equal(presets.some((preset) => preset.id === "daily-9am"), true);
});

test("nextRunAt resolves every-15-minute cron", () => {
  const from = new Date("2026-02-06T10:07:13.000Z");
  const next = nextRunAt("*/15 * * * *", "UTC", from);
  assert.ok(next);
  assert.equal(next.toISOString(), "2026-02-06T10:15:00.000Z");
});

test("nextRunAt supports weekday names and ranges", () => {
  const from = new Date("2026-02-07T10:07:13.000Z");
  const next = nextRunAt("0 9 * * mon-fri", "UTC", from);
  assert.ok(next);
  assert.equal(next.toISOString(), "2026-02-09T09:00:00.000Z");
});

test("buildSchedulePreview returns null next run for invalid cron", () => {
  const preview = buildSchedulePreview("not-a-cron", "UTC", new Date("2026-02-06T10:07:13.000Z"));
  assert.equal(preview.nextRunAtUtc, null);
  assert.equal(preview.nextRunAtLocal, null);
});

