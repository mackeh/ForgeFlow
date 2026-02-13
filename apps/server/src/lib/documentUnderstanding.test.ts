import test from "node:test";
import assert from "node:assert/strict";
import { understandDocument } from "./documentUnderstanding.js";

test("understandDocument parses key-value content and expected fields", () => {
  const result = understandDocument({
    text: "Invoice Number: INV-1001\nTotal: $1200.00\nVendor: ACME Corp",
    expectedFields: ["invoice_number", "total_amount", "due_date"]
  });

  assert.equal(result.fields.invoice_number, "INV-1001");
  assert.equal(result.fields.total, "$1200.00");
  assert.equal(result.fields.total_amount, "$1200.00");
  assert.equal(result.fields.due_date, null);
  assert.equal(result.confidence > 0, true);
});

test("understandDocument handles empty input safely", () => {
  const result = understandDocument({ text: "" });
  assert.equal(result.rawText, "");
  assert.deepEqual(result.fields, {});
  assert.equal(result.confidence, 0);
});
