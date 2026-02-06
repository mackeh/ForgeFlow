import test from "node:test";
import assert from "node:assert/strict";
import { attachRecorderWs, startWebRecorder, stopWebRecorder } from "./recorder.js";

class FakePage {
  binding: ((source: unknown, payload: any) => void) | null = null;
  gotoUrl: string | null = null;
  async addInitScript(_fn: unknown) {}
  async exposeBinding(_name: string, fn: (source: unknown, payload: any) => void) {
    this.binding = fn;
  }
  async goto(url: string) {
    this.gotoUrl = url;
  }
}

class FakeContext {
  page = new FakePage();
  async newPage() {
    return this.page as any;
  }
}

class FakeBrowser {
  context = new FakeContext();
  closed = false;
  async newContext() {
    return this.context as any;
  }
  async close() {
    this.closed = true;
  }
}

test("web recorder broadcasts captured events to websocket clients", async () => {
  const browser = new FakeBrowser();
  const info = await startWebRecorder(
    { startUrl: "https://example.com/form" },
    {
      launchBrowser: async () => browser as any,
      makeId: () => "session-1"
    }
  );

  assert.equal(info.sessionId, "session-1");
  assert.equal(browser.context.page.gotoUrl, "https://example.com/form");

  let onConnection: ((ws: any, req: any) => void) | null = null;
  const wss = {
    on: (event: string, handler: (ws: any, req: any) => void) => {
      if (event === "connection") onConnection = handler;
    }
  } as any;

  attachRecorderWs(wss);
  assert.ok(onConnection);
  const connect = onConnection as (ws: any, req: any) => void;

  const sent: string[] = [];
  const ws = {
    readyState: 1,
    send: (payload: string) => sent.push(payload),
    close: () => undefined,
    on: (_event: string, _handler: () => void) => undefined
  };

  connect(ws, { url: "/ws?type=recorder&sessionId=session-1" });
  assert.equal(sent.length >= 1, true);
  assert.equal(JSON.parse(sent[0]).type, "recorder:ready");

  browser.context.page.binding?.({}, { type: "click", selector: "#submit" });
  assert.equal(sent.length >= 2, true);
  assert.equal(JSON.parse(sent[1]).type, "recorder:event");

  const stopped = await stopWebRecorder("session-1");
  assert.equal(stopped?.events?.length, 1);
  assert.equal((stopped?.events?.[0] as any).selector, "#submit");
  assert.equal(browser.closed, true);
});

test("recorder websocket closes when session is unknown", async () => {
  let onConnection: ((ws: any, req: any) => void) | null = null;
  const wss = {
    on: (event: string, handler: (ws: any, req: any) => void) => {
      if (event === "connection") onConnection = handler;
    }
  } as any;

  attachRecorderWs(wss);
  assert.ok(onConnection);
  const connect = onConnection as (ws: any, req: any) => void;

  let closed = false;
  const ws = {
    readyState: 1,
    send: (_payload: string) => undefined,
    close: () => {
      closed = true;
    },
    on: (_event: string, _handler: () => void) => undefined
  };

  connect(ws, { url: "/ws?type=recorder&sessionId=missing" });
  assert.equal(closed, true);
});
