import { describe, expect, test } from "vitest";
import { STARTER_WALKTHROUGH_STEPS, clampWalkthroughIndex } from "./starterWalkthrough";

describe("starter walkthrough", () => {
  test("has stable step sequence", () => {
    expect(STARTER_WALKTHROUGH_STEPS.length).toBeGreaterThanOrEqual(5);
    expect(STARTER_WALKTHROUGH_STEPS[0].sectionId).toBe("templates");
  });

  test("clampWalkthroughIndex keeps values in range", () => {
    expect(clampWalkthroughIndex(-10)).toBe(0);
    expect(clampWalkthroughIndex(100)).toBe(STARTER_WALKTHROUGH_STEPS.length - 1);
  });
});
