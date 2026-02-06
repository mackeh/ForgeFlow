import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { rm } from "node:fs/promises";
import { appendAuditEvent, listAuditEvents } from "./auditStore.js";

async function useTempAudit(testName: string) {
  const file = path.join(os.tmpdir(), `forgeflow-audit-${testName}.json`);
  process.env.AUDIT_FILE = file;
  process.env.AUDIT_MAX_EVENTS = "3";
  await rm(file, { force: true });
}

test("audit store appends and lists newest first", async () => {
  await useTempAudit("order");
  await appendAuditEvent({
    actorUsername: "local",
    action: "workflow.create",
    resourceType: "workflow",
    resourceId: "wf-1"
  });
  await appendAuditEvent({
    actorUsername: "local",
    action: "workflow.update",
    resourceType: "workflow",
    resourceId: "wf-1"
  });
  const events = await listAuditEvents();
  assert.equal(events.length, 2);
  assert.equal(events[0].action, "workflow.update");
  assert.equal(events[1].action, "workflow.create");
});

test("audit store supports filtering", async () => {
  await useTempAudit("filter");
  await appendAuditEvent({
    actorUsername: "alice",
    action: "schedule.create",
    resourceType: "schedule"
  });
  await appendAuditEvent({
    actorUsername: "bob",
    action: "schedule.delete",
    resourceType: "schedule",
    success: false
  });
  const byActor = await listAuditEvents({ actorUsername: "alice" });
  assert.equal(byActor.length, 1);
  assert.equal(byActor[0].actorUsername, "alice");

  const failures = await listAuditEvents({ success: false });
  assert.equal(failures.length, 1);
  assert.equal(failures[0].action, "schedule.delete");
});

test("audit store trims old events using AUDIT_MAX_EVENTS", async () => {
  await useTempAudit("trim");
  await appendAuditEvent({ actorUsername: "u1", action: "a1", resourceType: "misc" });
  await appendAuditEvent({ actorUsername: "u2", action: "a2", resourceType: "misc" });
  await appendAuditEvent({ actorUsername: "u3", action: "a3", resourceType: "misc" });
  await appendAuditEvent({ actorUsername: "u4", action: "a4", resourceType: "misc" });

  const events = await listAuditEvents({ limit: 10 });
  assert.equal(events.length, 3);
  assert.equal(events.some((event) => event.action === "a1"), false);
  assert.equal(events[0].action, "a4");
});

