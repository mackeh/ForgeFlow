import test from "node:test";
import assert from "node:assert/strict";
import { buildSelectorCandidates, evaluateCondition, orderNodes, resolvePlaywrightHeadless } from "./runner.js";

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
