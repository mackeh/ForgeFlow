import test from "node:test";
import assert from "node:assert/strict";
import { ObservabilityRegistry, normalizeRequestPath, statusClass } from "./observability.js";

test("normalizeRequestPath redacts dynamic ids", () => {
  const path = "/api/workflows/123/runs/550e8400-e29b-41d4-a716-446655440000";
  const normalized = normalizeRequestPath(path);
  assert.equal(normalized, "/api/workflows/:id/runs/:id");
});

test("statusClass groups statuses", () => {
  assert.equal(statusClass(200), "2xx");
  assert.equal(statusClass(404), "4xx");
  assert.equal(statusClass(503), "5xx");
});

test("ObservabilityRegistry renders counters, gauges, and histograms", () => {
  const registry = new ObservabilityRegistry();
  registry.incrementCounter("forgeflow_http_requests_total", { method: "GET", path: "/health", status: "2xx" });
  registry.setGauge("forgeflow_active_runs", 2);
  registry.observeHistogram("forgeflow_http_request_duration_seconds", 0.2, { method: "GET", path: "/health" }, [0.1, 0.5, 1]);

  const rendered = registry.renderPrometheus();
  assert.equal(rendered.includes('forgeflow_http_requests_total{method="GET",path="/health",status="2xx"} 1'), true);
  assert.equal(rendered.includes("forgeflow_active_runs 2"), true);
  assert.equal(rendered.includes('forgeflow_http_request_duration_seconds_bucket{le="0.5",method="GET",path="/health"} 1'), true);
  assert.equal(rendered.includes('forgeflow_http_request_duration_seconds_count{method="GET",path="/health"} 1'), true);
});

