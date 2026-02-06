import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { rm } from "node:fs/promises";
import { createWebhook, listWebhookEventTypes, listWebhooks, updateWebhook } from "./webhookStore.js";

async function useTempWebhooks(testName: string) {
  const file = path.join(os.tmpdir(), `forgeflow-webhooks-${testName}.json`);
  process.env.WEBHOOKS_FILE = file;
  await rm(file, { force: true });
}

test("webhook store validates and stores webhook endpoints", async () => {
  await useTempWebhooks("create");

  const webhook = await createWebhook({
    name: "Run failed hook",
    url: "https://example.com/hook",
    events: ["run.failed", "run.succeeded"]
  });

  assert.equal(webhook.name, "Run failed hook");
  assert.equal(webhook.events.length, 2);

  const list = await listWebhooks();
  assert.equal(list.length, 1);
});

test("webhook store updates status metadata", async () => {
  await useTempWebhooks("update");

  const webhook = await createWebhook({
    name: "Metrics hook",
    url: "https://example.com/metrics",
    events: ["run.succeeded"]
  });

  const updated = await updateWebhook(webhook.id, {
    lastDeliveryStatus: "DELIVERED",
    lastDeliveryAt: new Date().toISOString(),
    lastDeliveryError: ""
  });

  assert.equal(updated.lastDeliveryStatus, "DELIVERED");
});

test("listWebhookEventTypes returns supported events", () => {
  const events = listWebhookEventTypes();
  assert.equal(events.includes("run.started"), true);
  assert.equal(events.includes("run.waiting_approval"), true);
});
