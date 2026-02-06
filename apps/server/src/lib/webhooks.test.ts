import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { rm } from "node:fs/promises";
import { createWebhook, listWebhooks } from "./webhookStore.js";
import { dispatchWebhookEvent } from "./webhooks.js";

async function useTempWebhooks(testName: string) {
  const file = path.join(os.tmpdir(), `forgeflow-webhooks-dispatch-${testName}.json`);
  process.env.WEBHOOKS_FILE = file;
  await rm(file, { force: true });
}

test("dispatchWebhookEvent posts matching events", async () => {
  await useTempWebhooks("dispatch");

  await createWebhook({
    name: "Run failed",
    url: "https://example.com/hook",
    events: ["run.failed"],
    enabled: true,
    secret: "test-secret"
  });

  const requests: Array<{ url: string; body: string }> = [];
  const originalFetch = global.fetch;
  (global as any).fetch = async (url: string, options: any) => {
    requests.push({ url, body: String(options?.body || "") });
    return { ok: true, status: 200 } as Response;
  };

  try {
    const result = await dispatchWebhookEvent("run.failed", { runId: "r1" });
    assert.equal(result.attempted, 1);
    assert.equal(result.delivered, 1);
    assert.equal(requests.length, 1);
    assert.equal(requests[0].url, "https://example.com/hook");
    assert.equal(requests[0].body.includes("run.failed"), true);

    const hooks = await listWebhooks();
    assert.equal(hooks[0].lastDeliveryStatus, "DELIVERED");
  } finally {
    (global as any).fetch = originalFetch;
  }
});
