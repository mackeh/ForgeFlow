import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { rm } from "node:fs/promises";
import {
  createIntegration,
  deleteIntegration,
  listIntegrations,
  parseCsvRows,
  testIntegrationConnection,
  updateIntegration
} from "./integrationStore.js";

async function resetIntegrationsFile(testId: string) {
  const file = path.join(os.tmpdir(), `forgeflow-integrations-${testId}.json`);
  process.env.INTEGRATIONS_FILE = file;
  await rm(file, { force: true });
}

test("integration store create/list/update/delete lifecycle", async () => {
  await resetIntegrationsFile("crud");
  const created = await createIntegration({
    name: "Primary API",
    type: "http_api",
    config: { baseUrl: "http://127.0.0.1:9" }
  });
  assert.equal(created.name, "Primary API");
  assert.equal(created.type, "http_api");
  assert.equal(created.config.baseUrl, "http://127.0.0.1:9");

  const listed = await listIntegrations();
  assert.equal(listed.length, 1);
  assert.equal(listed[0].name, "Primary API");

  const updated = await updateIntegration(created.id, {
    name: "Primary API v2",
    config: { baseUrl: "http://localhost:8080" }
  });
  assert.equal(updated.name, "Primary API v2");

  const removed = await deleteIntegration(created.id);
  assert.equal(removed, true);
  const finalList = await listIntegrations();
  assert.equal(finalList.length, 0);
});

test("testIntegrationConnection handles failure and validation paths", async () => {
  await resetIntegrationsFile("test");
  const created = await createIntegration({
    name: "Broken PG",
    type: "postgresql",
    config: { connectionString: "postgres://user:pass@127.0.0.1:1/db" }
  });
  const probe = await testIntegrationConnection({
    ...created,
    config: { connectionString: "postgres://user:pass@127.0.0.1:1/db" }
  } as any);
  assert.equal(probe.ok, false);
  assert.equal(typeof probe.message, "string");
});

test("parseCsvRows parses headers and row payloads", () => {
  const rows = parseCsvRows("name,email\nAlice,alice@example.com\nBob,bob@example.com");
  assert.equal(rows.length, 2);
  assert.equal(rows[0].name, "Alice");
  assert.equal(rows[1].email, "bob@example.com");
});
