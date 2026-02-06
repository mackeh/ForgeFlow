import test from "node:test";
import assert from "node:assert/strict";
import { startDesktopRecording, stopDesktopRecording } from "./agent.js";

test("desktop recording API helpers call the agent endpoints", async () => {
  const originalFetch = global.fetch;
  const calls: Array<{ url: string; method: string }> = [];

  global.fetch = (async (url: string, init?: RequestInit) => {
    calls.push({ url, method: String(init?.method || "GET") });
    return {
      ok: true,
      json: async () => ({ status: "ok" })
    } as any;
  }) as any;

  try {
    const start = await startDesktopRecording("batch");
    const stop = await stopDesktopRecording();
    assert.equal(start.status, "ok");
    assert.equal(stop.status, "ok");
    assert.equal(calls.length, 2);
    assert.equal(calls[0].url.endsWith("/record/start"), true);
    assert.equal(calls[0].method, "POST");
    assert.equal(calls[1].url.endsWith("/record/stop"), true);
  } finally {
    global.fetch = originalFetch;
  }
});

test("desktop recording helpers throw when agent returns non-ok status", async () => {
  const originalFetch = global.fetch;
  global.fetch = (async () => ({ ok: false, json: async () => ({}) } as any)) as any;

  try {
    await assert.rejects(() => startDesktopRecording("batch"), /Failed to start desktop recording/);
    await assert.rejects(() => stopDesktopRecording(), /Failed to stop desktop recording/);
  } finally {
    global.fetch = originalFetch;
  }
});
