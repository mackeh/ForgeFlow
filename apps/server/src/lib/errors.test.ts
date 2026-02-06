import test from "node:test";
import assert from "node:assert/strict";
import { AppError, toAppError, toErrorMessage } from "./errors.js";

test("toErrorMessage returns friendly message", () => {
  assert.equal(toErrorMessage(new Error("boom")), "boom");
  assert.equal(toErrorMessage("bad"), "bad");
  assert.equal(toErrorMessage({}), "Unexpected error");
});

test("toAppError keeps AppError instance", () => {
  const original = new AppError(404, "NOT_FOUND", "missing");
  const normalized = toAppError(original);
  assert.equal(normalized, original);
});

test("toAppError wraps unknown values", () => {
  const normalized = toAppError("invalid payload", 422, "VALIDATION_ERROR");
  assert.equal(normalized.status, 422);
  assert.equal(normalized.code, "VALIDATION_ERROR");
  assert.equal(normalized.message, "invalid payload");
});
