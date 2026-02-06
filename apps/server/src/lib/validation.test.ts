import test from "node:test";
import assert from "node:assert/strict";
import { deterministicFallback, parseJsonOutput, validateRecord, validateWithSchema } from "./validation.js";

test("validateWithSchema accepts valid payload", () => {
  const schema = {
    type: "object",
    required: ["name"],
    properties: {
      name: { type: "string" },
      age: { type: "number" }
    }
  };

  const result = validateWithSchema({ name: "Ada", age: 42 }, schema);
  assert.equal(result.ok, true);
});

test("validateWithSchema rejects invalid payload", () => {
  const schema = {
    type: "object",
    required: ["name"],
    properties: {
      name: { type: "string" }
    }
  };

  const result = validateWithSchema({ name: 42 }, schema);
  assert.equal(result.ok, false);
  assert.ok(result.errors.length > 0);
});

test("deterministicFallback pick_object keeps only schema keys", () => {
  const schema = {
    type: "object",
    properties: {
      email: { type: "string" },
      amount: { type: "number" }
    }
  };

  const output = deterministicFallback(
    { email: "x@y.com", amount: 7, extra: true },
    schema,
    "pick_object"
  ) as any;

  assert.deepEqual(output, { email: "x@y.com", amount: 7 });
});

test("parseJsonOutput extracts json block from model text", () => {
  const parsed = parseJsonOutput("Here is result:\n{\"ok\":true,\"count\":2}") as any;
  assert.equal(parsed.ok, true);
  assert.equal(parsed.count, 2);
});

test("validateRecord enforces required + pattern", () => {
  const result = validateRecord(
    { email: "user@example.com", name: "Ada" },
    { requiredFields: ["email", "name"], patterns: { email: "^[^@]+@[^@]+\\.[^@]+$" } }
  );
  assert.equal(result.ok, true);

  const bad = validateRecord(
    { email: "bad" },
    { requiredFields: ["email", "name"], patterns: { email: "^[^@]+@[^@]+\\.[^@]+$" } }
  );
  assert.equal(bad.ok, false);
  assert.ok(bad.errors.length >= 1);
});
