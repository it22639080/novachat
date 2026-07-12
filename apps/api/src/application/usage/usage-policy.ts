export type UsageAllowance = {
  allowed: boolean;
  includedRemaining: number;
  creditsRemaining: number;
  shouldConsumeCredit: boolean;
};

export function evaluateAllowance(used: number, includedLimit: number, extraCredits: number): UsageAllowance {
  const includedRemaining = Math.max(includedLimit - used, 0);
  const shouldConsumeCredit = includedRemaining <= 0;
  const creditsRemaining = Math.max(extraCredits, 0);

  return {
    allowed: includedRemaining > 0 || creditsRemaining > 0,
    includedRemaining,
    creditsRemaining,
    shouldConsumeCredit
  };
}

export function usageRatio(used: number, limit: number) {
  if (limit <= 0) {
    return used > 0 ? 1 : 0;
  }

  return Math.min(used / limit, 1);
}

export function costLimitReached(currentCost: number, limit: number) {
  return limit > 0 && currentCost >= limit;
}

export function warningThresholdsCrossed(ratio: number) {
  return {
    eighty: ratio >= 0.8,
    ninety: ratio >= 0.9,
    hundred: ratio >= 1
  };
}
