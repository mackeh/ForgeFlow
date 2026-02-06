import test from "node:test";
import assert from "node:assert/strict";
import {
  compareVisualBuffers,
  buildSelectorAiPrompt,
  buildSelectorCandidates,
  evaluateCondition,
  extractSelectorsFromAiResponse,
  orderNodes,
  resolvePlaywrightHeadless,
  selectorTextToCandidate
} from "./runner.js";

test("orderNodes returns all nodes even with cycle", () => {
  const definition = {
    nodes: [{ id: "a" }, { id: "b" }, { id: "c" }],
    edges: [
      { source: "a", target: "b" },
      { source: "b", target: "a" },
      { source: "b", target: "c" }
    ]
  };

  const ordered = orderNodes(definition).orderedNodes;
  assert.equal(ordered.length, 3);
  const ids = ordered.map((n: any) => n.id).sort();
  assert.deepEqual(ids, ["a", "b", "c"]);
});

test("buildSelectorCandidates creates prioritized strategies", () => {
  const list = buildSelectorCandidates({
    selectors: ["#one", ".btn"],
    testId: "submit",
    ariaLabel: "Submit",
    role: "button",
    name: "Send",
    selector: "button.primary",
    xpath: "//button[text()='Send']"
  });

  assert.equal(list.length, 7);
  assert.deepEqual(list[0], { kind: "css", selector: "#one" });
  assert.equal(list.some((item) => item.kind === "role"), true);
  assert.equal(list.some((item) => item.kind === "xpath"), true);
});

test("buildSelectorCandidates parses mixed selector string formats", () => {
  const list = buildSelectorCandidates({
    selectors: ["text=Submit", "xpath=//button[@id='save']"],
    selector: "role=button[name='Save']",
    textHint: "Continue"
  });

  assert.deepEqual(list[0], { kind: "text", selector: "Submit" });
  assert.deepEqual(list[1], { kind: "xpath", selector: "//button[@id='save']" });
  assert.equal(
    list.some((item) => item.kind === "role" && item.role === "button" && item.name === "Save"),
    true
  );
  assert.equal(list.some((item) => item.kind === "text" && item.selector === "Continue"), true);
});

test("resolvePlaywrightHeadless prefers node override, then workflow defaults, then env", () => {
  process.env.PLAYWRIGHT_HEADLESS = "true";
  assert.equal(resolvePlaywrightHeadless({ data: { headless: false } }, { playwrightHeadless: true }), false);
  assert.equal(resolvePlaywrightHeadless({ data: {} }, { playwrightHeadless: false }), false);
  assert.equal(resolvePlaywrightHeadless({ data: {} }, {}), true);

  process.env.PLAYWRIGHT_HEADLESS = "false";
  assert.equal(resolvePlaywrightHeadless({ data: {} }, {}), false);
});

test("evaluateCondition supports branch operators", () => {
  assert.equal(evaluateCondition(true, undefined, "truthy"), true);
  assert.equal(evaluateCondition(false, undefined, "falsy"), true);
  assert.equal(evaluateCondition(10, 5, "gt"), true);
  assert.equal(evaluateCondition(5, 5, "eq"), true);
  assert.equal(evaluateCondition("abc", "b", "contains"), true);
  assert.equal(evaluateCondition("x", ["a", "x"], "in"), true);
});

test("extractSelectorsFromAiResponse parses JSON payload", () => {
  const raw = JSON.stringify({
    selectors: ["#submit", "[data-testid='send-btn']", "text=Submit"]
  });
  const selectors = extractSelectorsFromAiResponse(raw);
  assert.equal(selectors.includes("#submit"), true);
  assert.equal(selectors.includes("text=Submit"), true);
});

test("extractSelectorsFromAiResponse parses line-based fallback", () => {
  const raw = ["- button.primary", "- [aria-label='Save']", "- text=Save"].join("\n");
  const selectors = extractSelectorsFromAiResponse(raw);
  assert.equal(selectors.some((value) => value.includes("button.primary")), true);
  assert.equal(selectors.some((value) => value.includes("[aria-label='Save']")), true);
});

test("buildSelectorAiPrompt includes action context and hints", () => {
  const prompt = buildSelectorAiPrompt(
    { selector: "button.btn-primary", value: "hello" },
    [{ text: "Save", testId: "save-btn", tag: "button" }]
  );
  assert.equal(prompt.includes("button.btn-primary"), true);
  assert.equal(prompt.includes("save-btn"), true);
  assert.equal(prompt.includes("Return ONLY JSON"), true);
});

test("selectorTextToCandidate parses css, text, and xpath forms", () => {
  assert.deepEqual(selectorTextToCandidate("button.primary"), { kind: "css", selector: "button.primary" });
  assert.deepEqual(selectorTextToCandidate("text=Submit"), { kind: "text", selector: "Submit" });
  assert.deepEqual(selectorTextToCandidate("//button[@id='save']"), {
    kind: "xpath",
    selector: "//button[@id='save']"
  });
});

test("selectorTextToCandidate parses role forms with optional name", () => {
  assert.deepEqual(selectorTextToCandidate("role=button[name='Approve']"), {
    kind: "role",
    role: "button",
    name: "Approve"
  });
  assert.deepEqual(selectorTextToCandidate("role=link"), {
    kind: "role",
    role: "link"
  });
});

test("compareVisualBuffers computes diff percentages deterministically", () => {
  const same = compareVisualBuffers(Buffer.from([1, 2, 3, 4]), Buffer.from([1, 2, 3, 4]));
  assert.equal(same.diffBytes, 0);
  assert.equal(same.diffPct, 0);

  const changed = compareVisualBuffers(Buffer.from([1, 2, 3, 4]), Buffer.from([1, 9, 3, 8]));
  assert.equal(changed.diffBytes, 2);
  assert.equal(changed.totalBytes, 4);
  assert.equal(changed.diffPct, 50);

  const mismatch = compareVisualBuffers(Buffer.from([1, 2]), Buffer.from([1, 2, 3]));
  assert.equal(mismatch.diffPct, 100);
});
