import { describe, expect, it } from "vitest";
import { costLimitReached, evaluateAllowance, usageRatio, warningThresholdsCrossed } from "./usage-policy.js";

describe("usage policy", () => {
  it("allows included usage before consuming credits", () => {
    const result = evaluateAllowance(4, 5, 10);

    expect(result.allowed).toBe(true);
    expect(result.includedRemaining).toBe(1);
    expect(result.shouldConsumeCredit).toBe(false);
  });

  it("consumes credits after included limit is reached", () => {
    const result = evaluateAllowance(5, 5, 2);

    expect(result.allowed).toBe(true);
    expect(result.includedRemaining).toBe(0);
    expect(result.creditsRemaining).toBe(2);
    expect(result.shouldConsumeCredit).toBe(true);
  });

  it("blocks usage when included limit and credits are exhausted", () => {
    expect(evaluateAllowance(5, 5, 0).allowed).toBe(false);
  });

  it("detects cost limits and warning thresholds", () => {
    expect(costLimitReached(10, 10)).toBe(true);
    expect(usageRatio(8, 10)).toBe(0.8);
    expect(warningThresholdsCrossed(0.9)).toEqual({
      eighty: true,
      ninety: true,
      hundred: false
    });
  });
});
