import test from "node:test";
import assert from "node:assert/strict";
import { loadRateLimitConfig } from "./rateLimit.js";

test("loadRateLimitConfig uses sane defaults", () => {
  const cfg = loadRateLimitConfig({});
  assert.equal(cfg.windowMs, 900000);
  assert.equal(cfg.maxRequests, 300);
  assert.equal(cfg.loginMaxRequests, 25);
  assert.equal(cfg.trustProxy, false);
});

test("loadRateLimitConfig parses custom env values", () => {
  const cfg = loadRateLimitConfig({
    RATE_LIMIT_WINDOW_MS: "60000",
    RATE_LIMIT_MAX: "1000",
    RATE_LIMIT_LOGIN_MAX: "10",
    TRUST_PROXY: "true"
  });

  assert.equal(cfg.windowMs, 60000);
  assert.equal(cfg.maxRequests, 1000);
  assert.equal(cfg.loginMaxRequests, 10);
  assert.equal(cfg.trustProxy, true);
});

test("loadRateLimitConfig falls back on invalid env values", () => {
  const cfg = loadRateLimitConfig({
    RATE_LIMIT_WINDOW_MS: "not-a-number",
    RATE_LIMIT_MAX: "0",
    RATE_LIMIT_LOGIN_MAX: "-5",
    TRUST_PROXY: "nope"
  });

  assert.equal(cfg.windowMs, 900000);
  assert.equal(cfg.maxRequests, 300);
  assert.equal(cfg.loginMaxRequests, 25);
  assert.equal(cfg.trustProxy, false);
});
